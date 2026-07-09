import React, { useState, useEffect } from 'react';
import { Container, Form, Button, FormCheck, Badge, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import DailyGoalTracker from '../DailyGoalTracker';

const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val.toDate === 'function') {
        try {
            const d = val.toDate();
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {}
    }
    if (val && typeof val === 'object' && typeof val.seconds === 'number') {
        try {
            const d = new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {}
    }
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        return null;
    }
};

const languageMap = {
    'english': 'İngilizce',
    'german': 'Almanca',
    'french': 'Fransızca',
    'spanish': 'İspanyolca',
    'italian': 'İtalyanca',
    'russian': 'Rusça',
    'turkish': 'Türkçe',
    'japanese': 'Japonca',
    'arabic': 'Arapça',
    'chinese': 'Çince',
    'korean': 'Korece',
    'portuguese': 'Portekizce'
};

const getLanguageLabel = (lang) => {
    if (!lang) return 'Belirtilmemiş';
    const lower = lang.toLowerCase();
    return languageMap[lower] || lang.charAt(0).toUpperCase() + lang.slice(1);
};

const availableContexts = [
    'Yalın Hal',
    'Geniş Zaman',
    'Geçmiş Zaman',
    'Past Participle',
    'Şimdiki Zaman'
];

function PracticeTestOptions({ words, maxQuestions, onStart, onCancel, savedOptions, onSaveOptions, practiceTests, onResumeTest, onDeleteTest, onDeleteAllTests, onTogglePinTest, customLists, customQuickTests = [], onSaveQuickTest, onDeleteQuickTest, dailyStats }) {
    const [questionCount, setQuestionCount] = useState(Math.min(10, maxQuestions));
    const [onlyStarred, setOnlyStarred] = useState(false);
    const [activeQuickTestId, setActiveQuickTestId] = useState(null);
    const [questionFormat, setQuestionFormat] = useState('mixed'); // 'definition' or 'term' or 'mixed'
    const [selectedLanguage, setSelectedLanguage] = useState('all');
    const [shuffle, setShuffle] = useState(true);
    const [excludeStarred, setExcludeStarred] = useState(false);
    const [excludeSolvedToday, setExcludeSolvedToday] = useState(false);

    const uniqueLanguages = React.useMemo(() => {
        const langs = new Set();
        (words || []).forEach(w => {
            if (w.language) {
                langs.add(w.language);
            }
        });
        return Array.from(langs).sort();
    }, [words]);

    // New State for Learning Status
    const [learningStatus, setLearningStatus] = useState({
        "Yeni": true,
        "Öğreniyor": true,
        "Öğrendi": true
    });

    // New State for Custom Lists
    const [selectedLists, setSelectedLists] = useState({});
    const [showAllLists, setShowAllLists] = useState(false);

    // New State for Question Types
    const [questionTypes, setQuestionTypes] = useState({
        "mcq": true,       // Multiple Choice
        "tf": true,        // True / False
        "flashcard": true, // Flash Card
        "written": false   // Written Answer
    });

    // New State for Advanced/Gamified Options
    const [advancedOptions, setAdvancedOptions] = useState({
        smartDistractors: false,
        missingLetters: false,
        comboStreak: false,
        matchPairs: false,
        progressiveHint: false,
        timeSurvival: false,
        singleMeaning: false,
        fillInTheBlanks: false
    });

    const [testHelps, setTestHelps] = useState({
        showLetterCounter: true,
        colorOnLengthMatch: true,
        colorOnExactMatch: true
    });

    const [deleteAllStatus, setDeleteAllStatus] = useState('idle');
    const [deleteProgress, setDeleteProgress] = useState(0);

    const [selectedContexts, setSelectedContexts] = useState(() => {
        const initial = {};
        availableContexts.forEach(c => initial[c] = true);
        return initial;
    });

    // Track if we've already loaded saved options to avoid re-loading on every savedOptions update
    const [hasLoaded, setHasLoaded] = useState(false);
 
    // Load saved options only once on mount if available
    useEffect(() => {
        if (savedOptions && !hasLoaded) {
            setHasLoaded(true);
            if (savedOptions.questionCount !== undefined) setQuestionCount(savedOptions.questionCount);
            if (savedOptions.onlyStarred !== undefined) setOnlyStarred(savedOptions.onlyStarred);
            if (savedOptions.questionFormat !== undefined) setQuestionFormat(savedOptions.questionFormat);
            if (savedOptions.selectedLanguage !== undefined) setSelectedLanguage(savedOptions.selectedLanguage);
            if (savedOptions.shuffle !== undefined) setShuffle(savedOptions.shuffle);
            if (savedOptions.excludeStarred !== undefined) setExcludeStarred(savedOptions.excludeStarred);
            if (savedOptions.excludeSolvedToday !== undefined) setExcludeSolvedToday(savedOptions.excludeSolvedToday);
            if (savedOptions.learningStatus !== undefined) setLearningStatus(savedOptions.learningStatus);
            if (savedOptions.questionTypes !== undefined) setQuestionTypes(savedOptions.questionTypes);
            if (savedOptions.advancedOptions !== undefined) setAdvancedOptions(savedOptions.advancedOptions);
            if (savedOptions.selectedLists !== undefined) setSelectedLists(savedOptions.selectedLists);
            if (savedOptions.testHelps !== undefined) setTestHelps(savedOptions.testHelps);
            if (savedOptions.selectedContexts !== undefined) {
                setSelectedContexts(savedOptions.selectedContexts);
            } else {
                const initial = {};
                availableContexts.forEach(c => initial[c] = true);
                if (Object.keys(savedOptions).length > 0) {
                    setSelectedContexts(initial);
                }
            }
        }
    }, [savedOptions, availableContexts, hasLoaded]);

    // Cleanup selectedLists when customLists change (e.g. if a list was deleted)
    useEffect(() => {
        if (!customLists || !hasLoaded) return;
        const validIds = new Set(customLists.map(l => l.id));
        let changed = false;
        const updatedSelected = { ...selectedLists };

        Object.keys(updatedSelected).forEach(id => {
            if (updatedSelected[id] && !validIds.has(id)) {
                delete updatedSelected[id];
                changed = true;
            }
        });

        if (changed) {
            setSelectedLists(updatedSelected);
        }
    }, [customLists, hasLoaded, selectedLists]);
 
    // Save options when they change (onSaveOptions is a stable setter, excluded from deps intentionally)
    useEffect(() => {
        if (!onSaveOptions || !hasLoaded) return;
        onSaveOptions({
            questionCount,
            onlyStarred,
            questionFormat,
            selectedLanguage,
            shuffle,
            learningStatus,
            questionTypes,
            advancedOptions,
            selectedLists,
            selectedContexts,
            testHelps,
            excludeStarred,
            excludeSolvedToday
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasLoaded, questionCount, onlyStarred, questionFormat, selectedLanguage, shuffle, learningStatus, questionTypes, advancedOptions, selectedLists, selectedContexts, excludeStarred, testHelps, excludeSolvedToday]);

    // Find all word IDs correctly solved in existing tests
    const solvedWordIds = React.useMemo(() => {
        const solvedIds = new Set();
        if (practiceTests) {
            practiceTests.forEach(test => {
                if (test.solvedWordIds && Array.isArray(test.solvedWordIds)) {
                    test.solvedWordIds.forEach(id => solvedIds.add(id));
                }
                if (test.questions) {
                    test.questions.forEach((q, idx) => {
                        const isCorrect = test.answers && test.answers[idx] && test.answers[idx].selected?.isCorrect === true;
                        if (isCorrect && q.wordId) {
                            solvedIds.add(q.wordId);
                        }
                    });
                }
            });
        }
        return solvedIds;
    }, [practiceTests]);

    // Calculate available questions based on current filters
    const availableWordsCount = (words || []).filter(w => {
        if (onlyStarred && !w.isStarred) return false;
        if (excludeStarred && w.isStarred) return false;
        if (excludeSolvedToday && solvedWordIds.has(w.id)) return false;
        
        if (selectedLanguage && selectedLanguage !== 'all') {
            if (w.language !== selectedLanguage) return false;
        }
        
        // Filter by Custom Lists
        const activeListIds = Object.keys(selectedLists).filter(id => selectedLists[id]);
        const hasListSelection = activeListIds.length > 0;

        // Filter by Learning Status (Only if no custom lists are selected)
        if (!hasListSelection) {
            if (learningStatus && !learningStatus[w.learningStatus || 'Yeni']) return false;
        }
        
        if (hasListSelection && customLists) {
            const allowedIds = new Set();
            customLists
                .filter(l => activeListIds.includes(l.id))
                .forEach(l => {
                    if (l.wordIds) l.wordIds.forEach(id => allowedIds.add(id));
                });
            if (!allowedIds.has(w.id)) return false;
        }
        
        return true;
    }).length;

    const counts = {
        yeni: (words || []).filter(w => (w.learningStatus || 'Yeni') === 'Yeni').length,
        ogreniyor: (words || []).filter(w => w.learningStatus === 'Öğreniyor').length,
        ogrendi: (words || []).filter(w => w.learningStatus === 'Öğrendi').length,
        starred: (words || []).filter(w => w.isStarred).length
    };

    const maxSelectableCount = Math.min(availableWordsCount, maxQuestions);

    useEffect(() => {
        if (maxSelectableCount > 0) {
            if (questionCount > maxSelectableCount) {
                setQuestionCount(maxSelectableCount);
            }
        }
        if (questionCount < 1) {
            setQuestionCount(1);
        }
    }, [maxSelectableCount, questionCount]);

    const getAvailableWordsCountForConfig = (config) => {
        return (words || []).filter(w => {
            if (config.onlyStarred && !w.isStarred) return false;
            if (config.excludeStarred && w.isStarred) return false;
            if (config.excludeSolvedToday && solvedWordIds.has(w.id)) return false;
            
            if (config.selectedLanguage && config.selectedLanguage !== 'all') {
                if (w.language !== config.selectedLanguage) return false;
            }
            
            // Filter by Custom Lists
            const activeListIds = Object.keys(config.selectedLists || {}).filter(id => config.selectedLists[id]);
            const hasListSelection = activeListIds.length > 0;

            // Filter by Learning Status (Only if no custom lists are selected)
            if (!hasListSelection) {
                if (config.learningStatus && !config.learningStatus[w.learningStatus || 'Yeni']) return false;
            }
            
            if (hasListSelection && customLists) {
                const allowedIds = new Set();
                customLists
                    .filter(l => activeListIds.includes(l.id))
                    .forEach(l => {
                        if (l.wordIds) l.wordIds.forEach(id => allowedIds.add(id));
                    });
                if (!allowedIds.has(w.id)) return false;
            }
            
            return true;
        }).length;
    };

    const selectQuickTest = (test) => {
        const cfg = test.config;
        
        setQuestionCount(cfg.questionCount);
        setOnlyStarred(cfg.onlyStarred);
        setExcludeStarred(cfg.excludeStarred);
        setExcludeSolvedToday(cfg.excludeSolvedToday);
        setQuestionFormat(cfg.questionFormat);
        setSelectedLanguage(cfg.selectedLanguage || 'all');
        setShuffle(cfg.shuffle);
        setLearningStatus(cfg.learningStatus || {});
        setQuestionTypes(cfg.questionTypes || {});
        setAdvancedOptions(cfg.advancedOptions || {});
        setSelectedLists(cfg.selectedLists || {});
        setSelectedContexts(cfg.selectedContexts || {});
        setTestHelps(cfg.testHelps || {});
        
        setActiveQuickTestId(test.id);
    };

    const isQuickTestModified = (test) => {
        if (!test) return false;
        const cfg = test.config;
        
        if (questionCount !== cfg.questionCount) return true;
        if (onlyStarred !== cfg.onlyStarred) return true;
        if (excludeStarred !== cfg.excludeStarred) return true;
        if (excludeSolvedToday !== cfg.excludeSolvedToday) return true;
        if (questionFormat !== cfg.questionFormat) return true;
        if (selectedLanguage !== (cfg.selectedLanguage || 'all')) return true;
        if (shuffle !== cfg.shuffle) return true;
        
        // Compare learningStatus
        const statusKeys = ["Yeni", "Öğreniyor", "Öğrendi"];
        for (const key of statusKeys) {
            if (!!learningStatus[key] !== !!cfg.learningStatus[key]) return true;
        }
        
        // Compare questionTypes
        const typeKeys = ["mcq", "tf", "flashcard", "written"];
        for (const key of typeKeys) {
            if (!!questionTypes[key] !== !!cfg.questionTypes[key]) return true;
        }
        
        // Compare advancedOptions
        const advKeys = Object.keys(cfg.advancedOptions || {});
        for (const key of advKeys) {
            if (!!advancedOptions[key] !== !!cfg.advancedOptions[key]) return true;
        }
        
        // Compare selectedLists
        const listKeys = Object.keys({ ...selectedLists, ...cfg.selectedLists });
        for (const key of listKeys) {
            if (!!selectedLists[key] !== !!cfg.selectedLists[key]) return true;
        }
        
        return false;
    };

    const updateCustomQuickTest = (id, e) => {
        e.stopPropagation();
        onSaveQuickTest(id, null, {
            questionCount,
            onlyStarred,
            excludeStarred,
            excludeSolvedToday,
            questionFormat,
            selectedLanguage,
            shuffle,
            learningStatus: { ...learningStatus },
            questionTypes: { ...questionTypes },
            advancedOptions: { ...advancedOptions },
            selectedLists: { ...selectedLists },
            selectedContexts: { ...selectedContexts },
            testHelps: { ...testHelps }
        });
        
        Swal.fire({
            icon: 'success',
            title: 'Güncellendi!',
            text: 'Hızlı test ayarları başarıyla güncellendi.',
            timer: 1500,
            showConfirmButton: false
        });
    };

    const handleSaveAsQuickTest = async () => {
        // Validation: At least one question type must be selected
        if (!questionTypes.mcq && !questionTypes.tf && !questionTypes.flashcard && !questionTypes.written) {
            Swal.fire({
                icon: 'warning',
                title: 'Uyarı',
                text: 'Lütfen en az bir Soru Tipi seçiniz.',
                confirmButtonText: 'Tamam'
            });
            return;
        }

        const { value: testName } = await Swal.fire({
            title: 'Hızlı Test Olarak Kaydet',
            input: 'text',
            inputLabel: 'Hızlı test için bir isim giriniz:',
            inputPlaceholder: 'Örn: Kelime Pratiği',
            showCancelButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Lütfen geçerli bir isim giriniz!';
                }
            }
        });

        if (testName) {
            const newId = onSaveQuickTest(null, testName.trim(), {
                questionCount,
                onlyStarred,
                excludeStarred,
                excludeSolvedToday,
                questionFormat,
                selectedLanguage,
                shuffle,
                learningStatus: { ...learningStatus },
                questionTypes: { ...questionTypes },
                advancedOptions: { ...advancedOptions },
                selectedLists: { ...selectedLists },
                selectedContexts: { ...selectedContexts },
                testHelps: { ...testHelps }
            });
            setActiveQuickTestId(newId);
            Swal.fire({
                icon: 'success',
                title: 'Kaydedildi!',
                text: `"${testName.trim()}" hızlı test olarak kaydedildi.`,
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    const handleEditQuickTestName = async (id, currentName, e) => {
        e.stopPropagation();
        const { value: newName } = await Swal.fire({
            title: 'Hızlı Test İsmini Düzenle',
            input: 'text',
            inputValue: currentName,
            inputPlaceholder: 'Örn: Kelime Pratiği',
            showCancelButton: true,
            confirmButtonText: 'Güncelle',
            cancelButtonText: 'İptal',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Lütfen geçerli bir isim giriniz!';
                }
            }
        });

        if (newName && newName.trim() && newName.trim() !== currentName) {
            onSaveQuickTest(id, newName.trim(), null);
            Swal.fire({
                icon: 'success',
                title: 'Güncellendi!',
                text: 'Hızlı test ismi başarıyla güncellendi.',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    const deleteCustomQuickTest = (id, e) => {
        e.stopPropagation();
        Swal.fire({
            title: 'Hızlı Testi Sil',
            text: 'Bu hızlı testi silmek istediğinize emin misiniz?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, Sil',
            cancelButtonText: 'İptal',
            confirmButtonColor: '#d33',
        }).then(result => {
            if (result.isConfirmed) {
                onDeleteQuickTest(id);
                if (activeQuickTestId === id) {
                    setActiveQuickTestId(null);
                }
            }
        });
    };

    const getQuickTestDescription = (config) => {
        const types = [];
        if (config.questionTypes.mcq) types.push('Çoktan Seçmeli');
        if (config.questionTypes.tf) types.push('Doğru/Yanlış');
        if (config.questionTypes.flashcard) types.push('Flashcard');
        if (config.questionTypes.written) types.push('Yazılı');
        
        let typeStr = types.join(', ');
        if (types.length > 2) typeStr = 'Karışık';
        else if (types.length === 0) typeStr = 'Seçilmedi';

        const statuses = [];
        if (config.learningStatus) {
            if (config.learningStatus['Yeni']) statuses.push('Yeni');
            if (config.learningStatus['Öğreniyor']) statuses.push('Öğreniyor');
            if (config.learningStatus['Öğrendi']) statuses.push('Öğrendi');
        }
        let statusStr = '';
        if (statuses.length === 3) {
            statusStr = 'Tümü';
        } else if (statuses.length === 0) {
            statusStr = 'Seçilmedi';
        } else {
            statusStr = statuses.join('+');
        }

        let starStr = 'Yıldızlı + Yıldızsız';
        let starIcon = 'bi-star-half';
        if (config.onlyStarred) {
            starStr = 'Sadece Yıldızlı';
            starIcon = 'bi-star-fill';
        } else if (config.excludeStarred) {
            starStr = 'Yıldızsız';
            starIcon = 'bi-star';
        }

        const languageStr = getLanguageLabel(config.selectedLanguage || 'all');
        
        let formatStr = '';
        if (config.questionFormat === 'mixed') {
            formatStr = 'Karışık';
        } else if (config.questionFormat === 'term') {
            const l = config.selectedLanguage && config.selectedLanguage !== 'all' ? getLanguageLabel(config.selectedLanguage) : 'Yabancı Dil';
            formatStr = `${l} → Türkçe`;
        } else if (config.questionFormat === 'definition') {
            const l = config.selectedLanguage && config.selectedLanguage !== 'all' ? getLanguageLabel(config.selectedLanguage) : 'Yabancı Dil';
            formatStr = `Türkçe → ${l}`;
        } else {
            formatStr = 'Karışık';
        }

        return {
            questionCount: `${config.questionCount} Soru`,
            typeStr,
            statusStr,
            starStr,
            starIcon,
            languageStr,
            formatStr
        };
    };

    const handleStart = () => {
        // Validation: At least one question type must be selected
        if (!questionTypes.mcq && !questionTypes.tf && !questionTypes.flashcard && !questionTypes.written) {
            Swal.fire({
                icon: 'warning',
                title: 'Uyarı',
                text: 'Lütfen en az bir Soru Tipi seçiniz.',
                confirmButtonText: 'Tamam'
            });
            return;
        }

        onStart({
            questionCount: Math.min(questionCount, maxSelectableCount),
            onlyStarred,
            questionFormat,
            selectedLanguage,
            shuffle,
            learningStatus,
            questionTypes,
            advancedOptions,
            selectedLists,
            selectedContexts,
            testHelps,
            excludeStarred,
            excludeSolvedToday
        });
    };

    return (
        <div className="premium-practice-wrapper animate-fade-in py-2">
            {/* Premium Dashboard Header Banner */}
            <div 
                className="premium-header-banner mb-4 p-4 p-md-5 rounded-4 d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between text-white position-relative overflow-hidden gap-4" 
                style={{ 
                    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    boxShadow: '0 10px 30px rgba(6, 182, 212, 0.12)',
                    borderRadius: '24px'
                }}
            >
                {/* Background glow overlay */}
                <div 
                    className="position-absolute rounded-circle" 
                    style={{ 
                        width: '180px', 
                        height: '180px', 
                        background: 'rgba(255, 255, 255, 0.08)', 
                        top: '-60px', 
                        right: '-30px',
                        filter: 'blur(35px)',
                        pointerEvents: 'none'
                    }}
                ></div>
                
                <div className="d-flex align-items-center gap-4">
                    <div 
                        className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" 
                        style={{ 
                            width: '56px', 
                            height: '56px', 
                            background: 'rgba(255, 255, 255, 0.15)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
                            backdropFilter: 'blur(4px)'
                        }}
                    >
                        <i className="bi bi-controller fs-3 text-white"></i>
                    </div>
                    <div>
                        <h2 className="fw-extrabold mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.65rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
                            Pratik Yap & Test Çöz
                        </h2>
                        <p className="mb-0 text-white-50 small" style={{ fontSize: '0.88rem', opacity: 0.85 }}>
                            Seçenekleri belirleyerek kelime dağarcığınızı test edin, hızlı test şablonlarıyla pratik yapın.
                        </p>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2 mt-2 mt-md-0 flex-wrap">
                    <Button 
                        variant="link" 
                        className="btn btn-sm d-flex align-items-center gap-2 px-3 py-2 border text-white" 
                        onClick={handleSaveAsQuickTest}
                        style={{ 
                            borderRadius: '100px',
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderColor: 'rgba(255, 255, 255, 0.25)',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            textDecoration: 'none',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                    >
                        <i className="bi bi-bookmark-plus"></i>
                        <span>Hızlı Teste Kaydet</span>
                    </Button>
                    <Button 
                        variant="light" 
                        className="btn btn-sm d-flex align-items-center gap-2 px-4 py-2 border-0 fw-bold shadow-sm" 
                        onClick={handleStart} 
                        style={{ 
                            borderRadius: '100px',
                            color: '#0891b2',
                            background: '#ffffff',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <i className="bi bi-play-fill fs-5"></i>
                        <span>Teste Başla</span>
                    </Button>
                </div>
            </div>

            <div className="text-body-secondary w-100">
                {/* Hızlı Test Oluştur Bölümü */}
                <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                    <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                        <i className="bi bi-lightning-charge-fill text-warning"></i>
                        <span>Hızlı Test Oluştur</span>
                    </h6>
                    <div className="d-flex flex-nowrap overflow-x-auto gap-3 pb-2 custom-scrollbar" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                        {(() => {
                            const slots = [];
                            const totalTestsCount = customQuickTests.length;
                            for (let i = 0; i < totalTestsCount; i++) {
                                slots.push({ type: 'custom', data: customQuickTests[i] });
                            }
                            const minSlots = 4;
                            const emptySlotsNeeded = Math.max(minSlots - totalTestsCount, totalTestsCount >= minSlots ? 1 : 0);
                            for (let i = 0; i < emptySlotsNeeded; i++) {
                                slots.push({ type: 'empty' });
                            }

                            return slots.map((slot, index) => {
                                if (slot.type === 'custom') {
                                    const test = slot.data;
                                    const isActive = activeQuickTestId === test.id;
                                    const isModified = isActive && isQuickTestModified(test);

                                    return (
                                        <div key={test.id} className="flex-shrink-0" style={{ width: '190px' }}>
                                            <div 
                                                className={`btn w-100 quick-test-card text-start d-flex flex-column justify-content-between position-relative ${isActive ? 'active-card' : ''}`}
                                                style={{ minHeight: '180px', cursor: 'pointer' }}
                                                onClick={() => selectQuickTest(test)}
                                            >
                                                {/* Action Buttons Container */}
                                                <div className="position-absolute d-flex align-items-center gap-2 quick-test-actions-container" style={{ top: '12px', right: '12px', zIndex: 5 }}>
                                                    {isModified && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-link btn-sm text-primary p-0"
                                                            style={{ textDecoration: 'none' }}
                                                            onClick={(e) => updateCustomQuickTest(test.id, e)}
                                                            title="Değişiklikleri hızlı teste kaydet"
                                                        >
                                                            <i className="bi bi-floppy-fill fs-6"></i>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm text-secondary p-0 quick-test-edit-btn"
                                                        style={{ textDecoration: 'none' }}
                                                        onClick={(e) => handleEditQuickTestName(test.id, test.name, e)}
                                                        title="İsmi düzenle"
                                                    >
                                                        <i className="bi bi-pencil-fill" style={{ fontSize: '11px' }}></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm text-danger p-0"
                                                        style={{ textDecoration: 'none' }}
                                                        onClick={(e) => deleteCustomQuickTest(test.id, e)}
                                                        title="Hızlı testi sil"
                                                    >
                                                        <i className="bi bi-trash3-fill"></i>
                                                    </button>
                                                </div>
                                                
                                                <div>
                                                    <h6 className="fw-bold text-body mb-2 pe-5 fs-6 quick-test-title" style={{ letterSpacing: '-0.2px', lineHeight: '1.3' }} title={test.name}>
                                                        {test.name}
                                                    </h6>
                                                    {(() => {
                                                        const desc = getQuickTestDescription(test.config);
                                                        return (
                                                            <div className="d-flex flex-column text-body-secondary mt-2" style={{ fontSize: '11px', opacity: 0.85, gap: '4px' }}>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <i className="bi bi-hash text-primary opacity-75" style={{ fontSize: '12px', width: '12px' }}></i>
                                                                    <span className="text-truncate">{desc.questionCount}</span>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <i className="bi bi-patch-question text-info opacity-75" style={{ fontSize: '12px', width: '12px' }}></i>
                                                                    <span className="text-truncate">{desc.typeStr}</span>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <i className="bi bi-translate text-success opacity-75" style={{ fontSize: '12px', width: '12px' }}></i>
                                                                    <span className="text-truncate">{desc.languageStr}</span>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <i className="bi bi-arrow-left-right text-danger opacity-75" style={{ fontSize: '12px', width: '12px' }}></i>
                                                                    <span className="text-truncate">{desc.formatStr}</span>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <i className="bi bi-mortarboard text-warning opacity-75" style={{ fontSize: '12px', width: '12px' }}></i>
                                                                    <span className="text-truncate d-flex align-items-center flex-wrap gap-1" style={{ fontWeight: '500' }}>
                                                                        {(() => {
                                                                            const active = [];
                                                                            if (test.config.learningStatus) {
                                                                                if (test.config.learningStatus['Yeni']) active.push('Yeni');
                                                                                if (test.config.learningStatus['Öğreniyor']) active.push('Öğreniyor');
                                                                                if (test.config.learningStatus['Öğrendi']) active.push('Öğrendi');
                                                                            }
                                                                            
                                                                            if (active.length === 0) return <span>Seçilmedi</span>;
                                                                            if (active.length === 3) {
                                                                                return (
                                                                                    <span className="d-inline-flex align-items-center gap-1">
                                                                                        <span className="d-inline-block rounded-circle" style={{ width: '6px', height: '6px', backgroundColor: 'var(--bs-body-color)', opacity: 0.7 }} />
                                                                                        <span>Tümü</span>
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            
                                                                            return active.map((status, sIdx) => {
                                                                                let dotColor = '#3b82f6'; // Yeni (Blue)
                                                                                if (status === 'Öğreniyor') dotColor = 'var(--bs-warning)'; // Öğreniyor (Bootstrap Warning)
                                                                                else if (status === 'Öğrendi') dotColor = '#10b981'; // Öğrendi (Green)
                                                                                
                                                                                return (
                                                                                    <span key={status} className="d-inline-flex align-items-center gap-1">
                                                                                        {sIdx > 0 && <span style={{ opacity: 0.5, margin: '0 1px' }}>+</span>}
                                                                                        <span className="d-inline-block rounded-circle" style={{ width: '6px', height: '6px', backgroundColor: dotColor, flexShrink: 0 }} />
                                                                                        <span>{status}</span>
                                                                                    </span>
                                                                                );
                                                                            });
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <i className={`bi ${desc.starIcon || 'bi-star'} quick-test-star opacity-75`} style={{ fontSize: '12px', width: '12px' }}></i>
                                                                    <span className="text-truncate">{desc.starStr}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div key={`empty-${index}`} className="flex-shrink-0" style={{ width: '190px' }}>
                                            <div 
                                                className="w-100 quick-test-placeholder d-flex align-items-center justify-content-center text-muted"
                                                style={{ minHeight: '180px', fontSize: '12px', cursor: 'pointer' }}
                                                title="Yukarıdaki ayarları yaptıktan sonra 'Hızlı Teste Kaydet' butonuna basarak buraya ekleyebilirsiniz."
                                            >
                                                <div className="text-center p-3">
                                                    <i className="bi bi-plus-circle-dashed fs-3 mb-2 d-block text-body-secondary opacity-75 placeholder-add-icon"></i>
                                                    <span className="fw-medium">Hızlı Test Ekle</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            });
                        })()}
                    </div>
                </div>

                {practiceTests && practiceTests.length > 0 && (
                    <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="text-body fw-bold mb-0">Tamamlanmış & Devam Eden Testler</h6>
                            <Button 
                                variant={deleteAllStatus === 'processing' ? 'secondary' : (deleteAllStatus === 'completed' ? 'outline-success' : 'outline-danger')} 
                                size="sm" 
                                className={`rounded-pill px-2 py-1 fw-bold overflow-hidden position-relative border ${deleteAllStatus !== 'idle' ? 'border-0' : ''} transition-all`} 
                                style={{ fontSize: '11px', minWidth: '90px', minHeight: '26px' }} 
                                disabled={deleteAllStatus !== 'idle'}
                                onClick={() => {
                                    Swal.fire({
                                        title: 'Tümünü Sil',
                                        text: 'Tüm sınav geçmişini silmek istediğinize emin misiniz? (Sabitlenen testler silinmeyecektir). Bu işlem geri alınamaz.',
                                        icon: 'warning',
                                        showCancelButton: true,
                                        confirmButtonText: 'Evet, Sil',
                                        cancelButtonText: 'İptal',
                                        confirmButtonColor: '#d33',
                                    }).then(async result => {
                                        if (result.isConfirmed && onDeleteAllTests) {
                                            setDeleteAllStatus('processing');
                                            setDeleteProgress(0);
                                            
                                            const interval = setInterval(() => {
                                                setDeleteProgress(prev => {
                                                    if (prev >= 90) return prev;
                                                    return prev + Math.random() * 15;
                                                });
                                            }, 100);

                                            try {
                                                await onDeleteAllTests();
                                                clearInterval(interval);
                                                setDeleteProgress(100);
                                                setDeleteAllStatus('completed');
                                            } catch (error) {
                                                clearInterval(interval);
                                                setDeleteAllStatus('idle');
                                            } finally {
                                                setTimeout(() => {
                                                    setDeleteAllStatus('idle');
                                                    setDeleteProgress(0);
                                                }, 1500);
                                            }
                                        }
                                    });
                                }}
                            >
                                {deleteAllStatus === 'processing' && (
                                    <div 
                                        className="position-absolute top-0 start-0 h-100 transition-all bg-secondary" 
                                        style={{ width: `${deleteProgress}%`, opacity: '0.3', transition: 'width 0.3s ease-out' }} 
                                    />
                                )}
                                <div className="d-flex align-items-center justify-content-center gap-1 position-relative" style={{ zIndex: 1 }}>
                                    {deleteAllStatus === 'processing' ? (
                                        <span className="fw-bold text-white">
                                            Siliniyor...
                                        </span>
                                    ) : deleteAllStatus === 'completed' ? (
                                        <span className="animated fadeIn d-flex align-items-center gap-1 text-success">
                                            <i className="bi bi-check-circle-fill"></i>
                                            <span>Silindi</span>
                                        </span>
                                    ) : (
                                        <span>Tümünü Sil</span>
                                    )}
                                </div>
                            </Button>
                        </div>
                        <div className="d-flex gap-2 pb-2" style={{ overflowX: 'auto', scrollbarWidth: 'thin', whiteSpace: 'nowrap' }}>
                            {practiceTests.map(test => {
                                const dateObj = parseDate(test.updatedAt) || parseDate(test.createdAt) || new Date();
                                const date = dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                                const isCompleted = test.status === 'completed';

                                const total = (test.questions && test.questions.length > 0) ? test.questions.length : (test.totalCount || 0);
                                let answeredCount = test.answeredCount !== undefined ? test.answeredCount : 0;
                                let correctCount = test.correctCount !== undefined ? test.correctCount : 0;

                                if (test.questions && test.questions.length > 0) {
                                    answeredCount = 0;
                                    correctCount = 0;
                                    test.questions.forEach((q, idx) => {
                                        if (test.answers && test.answers[idx]) {
                                            answeredCount++;
                                            if (test.answers[idx].selected?.isCorrect) {
                                                correctCount++;
                                            }
                                        } else if (q.type === 'written' && test.writtenInputs && (test.writtenInputs[idx] || '').trim().length > 0) {
                                            answeredCount++;
                                        }
                                    });
                                }
                                const unanswered = Math.max(0, total - answeredCount);
                                const successRate = total > 0 ? Math.round((correctCount / total) * 100) : 0;

                                let borderClass = 'border-secondary border-opacity-25';
                                let iconColor = 'text-warning'; // Default icon color for ongoing
                                if (isCompleted) {
                                    borderClass = 'border-success border-opacity-75';
                                    iconColor = 'text-success';
                                } else if (unanswered !== total) {
                                    borderClass = 'border-danger border-opacity-75';
                                }

                                return (
                                    <button
                                        key={test.id}
                                        type="button"
                                        className={`btn bg-transparent text-body rounded-4 px-2 py-1 fw-medium border text-nowrap d-flex align-items-center gap-2 flex-shrink-0 text-start ${borderClass}`}
                                        onClick={() => onResumeTest(test.id)}
                                        style={{ fontSize: '12px', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                                    >
                                        <div className="d-flex flex-column" style={{ lineHeight: '1.4' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                {isCompleted ? <i className={`bi bi-check-circle-fill ${iconColor}`}></i> : <i className={`bi bi-play-circle-fill ${iconColor}`}></i>}
                                                <span>{date}</span>
                                            </div>
                                            <small className="opacity-75 fw-normal" style={{ fontSize: '12px' }}>
                                                {total} Soru {isCompleted ? <span className="text-success fw-semibold"> • %{successRate} Başarı</span> : `• ${unanswered} Boş`}
                                            </small>
                                        </div>

                                        <div
                                            className="ms-auto d-flex align-items-center gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div
                                                className="d-flex align-items-center"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onTogglePinTest) {
                                                        onTogglePinTest(test.id, !test.isPinned);
                                                    }
                                                }}
                                                title={test.isPinned ? "Sök" : "Sabitle"}
                                            >
                                                <i className={`bi ${test.isPinned ? 'bi-pin-angle-fill text-primary' : 'bi-pin-angle text-muted'} opacity-75 hover-opacity-100 transition-all`} style={{ cursor: 'pointer', fontSize: '1.1rem' }}></i>
                                            </div>
                                            <div
                                                className="d-flex align-items-center"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    Swal.fire({
                                                        title: 'Testi Sil',
                                                        text: 'Bu testi silmek istediğinize emin misiniz?',
                                                        icon: 'warning',
                                                        showCancelButton: true,
                                                        confirmButtonText: 'Evet, Sil',
                                                        cancelButtonText: 'İptal',
                                                        confirmButtonColor: '#d33',
                                                    }).then(result => {
                                                        if (result.isConfirmed && onDeleteTest) {
                                                            onDeleteTest(test.id);
                                                        }
                                                    });
                                                }}
                                                title="Sil"
                                            >
                                                <i className="bi bi-x-lg text-danger opacity-75 hover-opacity-100 transition-all" style={{ cursor: 'pointer', fontSize: '1.1rem' }}></i>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <Row className="g-4">
                    {/* Column 1: Test Yapılandırması */}
                    <Col lg={4} className="d-flex flex-column gap-4">
                        <div className="border-0 shadow-sm rounded-4 p-4 bg-body-tertiary d-flex flex-column gap-4 h-100">
                            <div>
                                <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-hourglass-split text-info fs-5"></i>
                                    <span>Test Uzunluğu</span>
                                </h6>
                                <div className="d-flex justify-content-between align-items-start mt-2">
                                    <div>
                                        <span className="text-body small fw-medium">Soru Sayısı</span>
                                        <div className="text-muted mt-0" style={{ fontSize: '12px' }}>
                                            Seçili ayarlarla {availableWordsCount} kelime bulunuyor.
                                            {availableWordsCount > 0 && availableWordsCount < questionCount && (
                                                <span className="text-warning ms-1 d-block mt-0.5">Maksimum {availableWordsCount} soru çıkacak.</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="d-flex flex-column align-items-end gap-2 flex-shrink-0">
                                        <div className="d-flex align-items-center gap-2">
                                            <Form.Control
                                                type="number"
                                                value={questionCount}
                                                onChange={e => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                                                max={Math.max(1, maxSelectableCount)}
                                                min={1}
                                                className="bg-transparent text-body text-center border-secondary border-opacity-50 rounded-pill shadow-none"
                                                style={{ width: '65px', fontSize: '13px', height: '32px' }}
                                            />
                                            <Button
                                                variant="outline-secondary"
                                                size="sm"
                                                className="rounded-pill px-2 border-opacity-50 d-flex align-items-center justify-content-center"
                                                onClick={() => setQuestionCount(maxSelectableCount)}
                                                style={{ height: '31px', width: '31px' }}
                                                title="Tümünü Seç"
                                            >
                                                <i className="bi bi-check-all fs-5"></i>
                                            </Button>
                                        </div>
                                        <div className="d-flex gap-2">
                                            {[5, 10, 15].map(val => (
                                                <Button
                                                    key={val}
                                                    variant={questionCount === val ? 'primary' : 'outline-secondary'}
                                                    size="sm"
                                                    className="rounded-pill px-3 py-0 border-opacity-50 shadow-none d-flex align-items-center justify-content-center"
                                                    onClick={() => setQuestionCount(Math.min(val, maxSelectableCount))}
                                                    style={{ fontSize: '11px', height: '22px', fontWeight: '500' }}
                                                >
                                                    {val}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <hr className="my-0 border-secondary border-opacity-10" />

                            <div>
                                <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-translate text-success fs-5"></i>
                                    <span>Dil Seçimi</span>
                                </h6>
                                <div className="d-flex flex-wrap gap-2">
                                    {[
                                        { key: 'all', label: 'Tümü' },
                                        ...uniqueLanguages.map(lang => ({
                                            key: lang,
                                            label: getLanguageLabel(lang)
                                        }))
                                    ].map(({ key, label }) => (
                                        <Button
                                            key={key}
                                            type="button"
                                            variant={selectedLanguage === key ? 'primary' : 'outline-secondary'}
                                            className={`rounded-pill px-3 py-1 fw-medium border-opacity-50`}
                                            onClick={() => setSelectedLanguage(key)}
                                            style={{ fontSize: '12px' }}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <hr className="my-0 border-secondary border-opacity-10" />

                            <div>
                                <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-arrow-left-right text-danger fs-5"></i>
                                    <span>Soru Formatı</span>
                                </h6>
                                <div className="d-flex flex-column gap-2">
                                    {[
                                        { key: 'mixed', label: 'Karışık' },
                                        { key: 'term', label: `${selectedLanguage && selectedLanguage !== 'all' ? getLanguageLabel(selectedLanguage) : 'Yabancı Dil'} → Türkçe` },
                                        { key: 'definition', label: `Türkçe → ${selectedLanguage && selectedLanguage !== 'all' ? getLanguageLabel(selectedLanguage) : 'Yabancı Dil'}` }
                                    ].map(({ key, label }) => (
                                        <Button
                                            key={key}
                                            type="button"
                                            variant={questionFormat === key ? 'primary' : 'outline-secondary'}
                                            className={`rounded-pill px-3 py-2 fw-medium w-100 border-opacity-50 text-start`}
                                            onClick={() => setQuestionFormat(key)}
                                            style={{ fontSize: '12px' }}
                                        >
                                            <i className={`bi ${questionFormat === key ? 'bi-dot fw-bold' : 'bi-circle'} me-2`}></i>
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Col>

                    {/* Column 2: Hedef Kelime Filtreleri & Özel Listeler */}
                    <Col lg={4} className="d-flex flex-column gap-4">
                        <div className="border-0 shadow-sm rounded-4 p-4 bg-body-tertiary d-flex flex-column gap-4 h-100">
                            <div>
                                <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-funnel-fill text-warning fs-5"></i>
                                    <span>Hedef Kelime Filtreleri</span>
                                </h6>
                                
                                <div className="d-flex flex-column gap-3">
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span className="d-flex align-items-center gap-2">
                                            <i className="bi bi-circle-fill text-primary small" style={{ fontSize: '8px' }}></i> Yeni
                                            <Badge bg="secondary" className="bg-opacity-25 text-body rounded-pill ms-1" style={{ fontSize: '11px' }}>{counts.yeni}</Badge>
                                        </span>
                                        <FormCheck
                                            type="switch"
                                            className="custom-switch-lg"
                                            checked={learningStatus["Yeni"]}
                                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Yeni": e.target.checked }))}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span className="d-flex align-items-center gap-2">
                                            <i className="bi bi-circle-fill text-warning small" style={{ fontSize: '8px' }}></i> Öğreniyor
                                            <Badge bg="secondary" className="bg-opacity-25 text-body rounded-pill ms-1" style={{ fontSize: '11px' }}>{counts.ogreniyor}</Badge>
                                        </span>
                                        <FormCheck
                                            type="switch"
                                            className="custom-switch-lg"
                                            checked={learningStatus["Öğreniyor"]}
                                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Öğreniyor": e.target.checked }))}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span className="d-flex align-items-center gap-2">
                                            <i className="bi bi-circle-fill text-success small" style={{ fontSize: '8px' }}></i> Öğrendi
                                            <Badge bg="secondary" className="bg-opacity-25 text-body rounded-pill ms-1" style={{ fontSize: '11px' }}>{counts.ogrendi}</Badge>
                                        </span>
                                        <FormCheck
                                            type="switch"
                                            className="custom-switch-lg"
                                            checked={learningStatus["Öğrendi"]}
                                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Öğrendi": e.target.checked }))}
                                        />
                                    </div>

                                    <hr className="my-1 border-secondary border-opacity-10" />

                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span className="d-flex align-items-center gap-2">
                                            Sadece Yıldızlılar <i className="bi bi-star-fill text-warning fs-6"></i>
                                            <Badge bg="warning" className="text-dark rounded-pill ms-1" style={{ fontSize: '11px' }}>{counts.starred}</Badge>
                                        </span>
                                        <FormCheck
                                            type="switch"
                                            id="option-starred"
                                            className="custom-switch-lg"
                                            checked={onlyStarred}
                                            onChange={(e) => {
                                                setOnlyStarred(e.target.checked);
                                                if (e.target.checked) setExcludeStarred(false);
                                            }}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span className="d-flex align-items-center gap-2">
                                            Yıldızlılar Hariç <i className="bi bi-star text-body-secondary fs-6"></i>
                                        </span>
                                        <FormCheck
                                            type="switch"
                                            id="option-exclude-starred"
                                            className="custom-switch-lg"
                                            checked={excludeStarred}
                                            onChange={(e) => {
                                                setExcludeStarred(e.target.checked);
                                                if (e.target.checked) setOnlyStarred(false);
                                            }}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Kelimeleri Karıştır</span>
                                        <FormCheck
                                            type="switch"
                                            id="option-shuffle"
                                            className="custom-switch-lg"
                                            checked={shuffle}
                                            onChange={(e) => setShuffle(e.target.checked)}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Doğru Çözülenleri Ekleme</span>
                                        <FormCheck
                                            type="switch"
                                            id="option-exclude-solved-today"
                                            className="custom-switch-lg"
                                            checked={excludeSolvedToday}
                                            onChange={(e) => setExcludeSolvedToday(e.target.checked)}
                                        />
                                    </div>
                                    <div className="text-muted small mt-0" style={{ fontSize: '11px', marginTop: '-5px' }}>
                                        Ekarte edilecek kelime sayısı: <strong className="text-primary">{solvedWordIds.size}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Özel Listeler Section */}
                            {customLists && customLists.length > 0 && (
                                <>
                                    <hr className="my-0 border-secondary border-opacity-10" />
                                    <div>
                                        <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                                            <i className="bi bi-collection-play-fill text-info fs-5"></i>
                                            <span>Özel Listeler</span>
                                        </h6>
                                        {(() => {
                                            const sortedLists = [...customLists].sort((a, b) => {
                                                const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                                                const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                                                if (orderA !== orderB) return orderA - orderB;
                                                return (new Date(b.createdAt)) - (new Date(a.createdAt));
                                            });

                                            const listsToDisplay = showAllLists ? sortedLists : sortedLists.slice(0, 4);

                                            return (
                                                <div className="d-flex flex-column gap-2">
                                                    {listsToDisplay.map(list => (
                                                        <div key={list.id} className="d-flex justify-content-between align-items-center text-body">
                                                            <span className="d-flex align-items-center gap-2 text-truncate pe-2">
                                                                <i className="bi bi-collection-play text-info small" style={{ fontSize: '10px' }}></i>
                                                                <span className="text-truncate" style={{ maxWidth: '140px' }}>{list.name}</span>
                                                                <Badge bg="secondary" className="bg-opacity-25 text-body rounded-pill ms-1" style={{ fontSize: '11px' }}>
                                                                    {list.wordIds?.length || 0}
                                                                </Badge>
                                                            </span>
                                                            <FormCheck
                                                                type="switch"
                                                                className="custom-switch-lg"
                                                                checked={!!selectedLists[list.id]}
                                                                onChange={(e) => setSelectedLists(prev => ({ ...prev, [list.id]: e.target.checked }))}
                                                            />
                                                        </div>
                                                    ))}

                                                    {sortedLists.length > 4 && (
                                                        <div className="text-center mt-2">
                                                            <Button
                                                                variant="link"
                                                                className="text-decoration-none text-primary fw-bold p-0 d-flex align-items-center gap-1 mx-auto"
                                                                onClick={() => setShowAllLists(!showAllLists)}
                                                                style={{ fontSize: '12px' }}
                                                            >
                                                                {showAllLists ? (
                                                                    <>Daha Az <i className="bi bi-chevron-up"></i></>
                                                                ) : (
                                                                    <>Daha Fazla ({sortedLists.length - 4}) <i className="bi bi-chevron-down"></i></>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                    </Col>

                    {/* Column 3: Soru Tipleri & Yardımcılar */}
                    <Col lg={4} className="d-flex flex-column gap-4">
                        <div className="border-0 shadow-sm rounded-4 p-4 bg-body-tertiary d-flex flex-column gap-4 h-100">
                            <div>
                                <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-question-diamond-fill text-primary fs-5"></i>
                                    <span>Soru Tipleri</span>
                                </h6>
                                <div className="d-flex flex-column gap-3">
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Çoktan Seçmeli (4 Şık)</span>
                                        <FormCheck
                                            type="switch"
                                            id="type-mcq"
                                            className="custom-switch-lg"
                                            checked={questionTypes.mcq}
                                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, mcq: e.target.checked }))}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Doğru / Yanlış</span>
                                        <FormCheck
                                            type="switch"
                                            id="type-tf"
                                            className="custom-switch-lg"
                                            checked={questionTypes.tf}
                                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, tf: e.target.checked }))}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Flash Kart</span>
                                        <FormCheck
                                            type="switch"
                                            id="type-flashcard"
                                            className="custom-switch-lg"
                                            checked={questionTypes.flashcard}
                                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, flashcard: e.target.checked }))}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Yazarak Cevapla</span>
                                        <FormCheck
                                            type="switch"
                                            id="type-written"
                                            className="custom-switch-lg"
                                            checked={questionTypes.written}
                                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, written: e.target.checked }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className="my-0 border-secondary border-opacity-10" />

                            <div>
                                <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-lightbulb-fill text-warning fs-5"></i>
                                    <span>Yardımcı Araçlar</span>
                                </h6>
                                <div className="d-flex flex-column gap-3">
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Harf Sayacı</span>
                                        <FormCheck
                                            type="switch"
                                            id="help-counter"
                                            className="custom-switch-lg"
                                            checked={testHelps.showLetterCounter}
                                            onChange={(e) => setTestHelps(prev => ({ ...prev, showLetterCounter: e.target.checked }))}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Uzunluk Eşleşince Yeşil Olsun</span>
                                        <FormCheck
                                            type="switch"
                                            id="help-green"
                                            className="custom-switch-lg"
                                            checked={testHelps.colorOnLengthMatch}
                                            onChange={(e) => setTestHelps(prev => ({ ...prev, colorOnLengthMatch: e.target.checked }))}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-body">
                                        <span>Tam Eşleşince Mavi Olsun</span>
                                        <FormCheck
                                            type="switch"
                                            id="help-blue"
                                            className="custom-switch-lg"
                                            checked={testHelps.colorOnExactMatch}
                                            onChange={(e) => setTestHelps(prev => ({ ...prev, colorOnExactMatch: e.target.checked }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* Ekstra Modlar Section */}
                <div className="border-0 shadow-sm rounded-4 p-4 bg-body-tertiary mt-4 mb-4">
                    <h6 className="text-body fw-bold mb-4 d-flex align-items-center gap-2">
                        <span>Ekstra Modlar</span>
                        <i className="bi bi-fire text-danger fs-5"></i>
                    </h6>

                    <Row className="g-3">
                        {/* 1. Örnek Cümle Tamamlama */}
                        <Col md={12} lg={8}>
                            <div className={`p-3 border rounded-4 transition-all h-100 ${advancedOptions.fillInTheBlanks ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-tertiary'}`}>
                                <div className="d-flex justify-content-between align-items-start text-body">
                                    <div>
                                        <div className="fw-bold d-flex align-items-center gap-2 text-primary">
                                            <i className="bi bi-chat-right-quote-fill"></i> Örnek Cümle Tamamlama (Mod)
                                        </div>
                                        <div className="text-muted small mt-1">Kelimenin örnek cümleleri içinde kelime gizlenir ve boşluk doldurmanız istenir. <strong>Tüm test bu formata dönüşür.</strong></div>
                                    </div>
                                    <FormCheck
                                        type="switch"
                                        className="custom-switch-lg mt-1"
                                        checked={advancedOptions.fillInTheBlanks}
                                        onChange={(e) => setAdvancedOptions(prev => ({ ...prev, fillInTheBlanks: e.target.checked }))}
                                    />
                                </div>

                                {availableContexts.length > 0 && (
                                    <div className={`mt-3 pt-3 border-top transition-all ${advancedOptions.fillInTheBlanks ? 'border-primary border-opacity-25' : 'border-secondary border-opacity-25'}`} style={{ opacity: advancedOptions.fillInTheBlanks ? 1 : 0.6 }}>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span className="text-body fw-medium small">Gramer Filtresi</span>
                                            <Button variant="link" size="sm" className={`text-decoration-none p-0 border-0 bg-transparent fw-semibold ${advancedOptions.fillInTheBlanks ? 'text-primary' : 'text-muted'}`} style={{ fontSize: '0.8rem' }} onClick={() => {
                                                const allSelected = Object.values(selectedContexts).every(v => v);
                                                const next = {};
                                                availableContexts.forEach(c => next[c] = !allSelected);
                                                setSelectedContexts(next);
                                            }}>
                                                {Object.values(selectedContexts).every(v => v) ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
                                            </Button>
                                        </div>
                                        <div className="d-flex flex-wrap gap-2 mt-1">
                                            {availableContexts.map(ctx => {
                                                const isSelected = selectedContexts[ctx];
                                                return (
                                                    <Badge
                                                        key={ctx}
                                                        bg={isSelected ? (advancedOptions.fillInTheBlanks ? "primary" : "secondary") : "secondary"}
                                                        className={`px-2 py-1 border ${isSelected && advancedOptions.fillInTheBlanks ? 'shadow-sm border-primary' : 'bg-opacity-10 text-body border-secondary border-opacity-25'} rounded-pill`}
                                                        style={{ cursor: 'pointer', transition: 'all 0.2s', fontWeight: isSelected ? 'bold' : 'normal', fontSize: '0.75rem' }}
                                                        onClick={() => setSelectedContexts(prev => ({ ...prev, [ctx]: !prev[ctx] }))}
                                                    >
                                                        {ctx}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Col>

                        {/* 2. Çeldirici Şıklar */}
                        <Col md={6} lg={4}>
                            <div className={`d-flex justify-content-between align-items-start text-body p-3 border rounded-4 transition-all h-100 ${advancedOptions.smartDistractors ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-tertiary'}`}>
                                <div>
                                    <div className="fw-bold d-flex align-items-center gap-2 text-warning">
                                        <i className="bi bi-exclamation-triangle-fill"></i> Çeldirici Şıklar
                                    </div>
                                    <div className="text-muted small mt-1">Çoktan seçmeli sınavlarda birbirine çok benzeyen ve şaşırtmacalı şıklar gelir.</div>
                                </div>
                                <FormCheck
                                    type="switch"
                                    className="custom-switch-lg mt-1"
                                    checked={advancedOptions.smartDistractors}
                                    onChange={(e) => setAdvancedOptions(prev => ({ ...prev, smartDistractors: e.target.checked }))}
                                />
                            </div>
                        </Col>

                        {/* 3. Eksik Harfler (Cellat Modu) */}
                        <Col md={6} lg={4}>
                            <div className={`d-flex justify-content-between align-items-start text-body p-3 border rounded-4 transition-all h-100 ${advancedOptions.missingLetters ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-tertiary'}`}>
                                <div>
                                    <div className="fw-bold d-flex align-items-center gap-2 text-info">
                                        <i className="bi bi-alphabet"></i> Eksik Harfler (Cellat Modu)
                                    </div>
                                    <div className="text-muted small mt-1">Yazılı cevaplarda kelimenin sadece bazı harfleri ipucu olarak verilir (Örn: `A_p_l_`).</div>
                                </div>
                                <FormCheck
                                    type="switch"
                                    className="custom-switch-lg mt-1"
                                    checked={advancedOptions.missingLetters}
                                    onChange={(e) => setAdvancedOptions(prev => ({ ...prev, missingLetters: e.target.checked }))}
                                />
                            </div>
                        </Col>

                        {/* 4. Gizli Anlamlar (Tek Anlam) */}
                        <Col md={6} lg={4}>
                            <div className={`d-flex justify-content-between align-items-start text-body p-3 border rounded-4 transition-all h-100 ${advancedOptions.singleMeaning ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-tertiary'}`}>
                                <div>
                                    <div className="fw-bold d-flex align-items-center gap-2 text-dark">
                                        <i className="bi bi-mask"></i> Gizli Anlamlar (Tek Anlam)
                                    </div>
                                    <div className="text-muted small mt-1">Birden fazla anlamı olan kelimelerde sadece rastgele 1 anlamı gösterilir. Tıkanınca "Diğer Anlam" butonuyla değiştirebilirsiniz.</div>
                                </div>
                                <FormCheck
                                    type="switch"
                                    className="custom-switch-lg mt-1"
                                    checked={advancedOptions.singleMeaning}
                                    onChange={(e) => setAdvancedOptions(prev => ({ ...prev, singleMeaning: e.target.checked }))}
                                />
                            </div>
                        </Col>

                        {/* 5. Combo / Seri Çarpanı */}
                        <Col md={6} lg={4}>
                            <div className={`d-flex justify-content-between align-items-start text-body p-3 border rounded-4 transition-all h-100 ${advancedOptions.comboStreak ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-tertiary'}`}>
                                <div>
                                    <div className="fw-bold d-flex align-items-center gap-2 text-danger">
                                        <i className="bi bi-lightning-charge-fill"></i> Combo / Seri Çarpanı
                                    </div>
                                    <div className="text-muted small mt-1">Arka arkaya doğru cevap verdikçe puan çarpanın artar (x2, x3) ve efektler çıkar.</div>
                                </div>
                                <FormCheck
                                    type="switch"
                                    className="custom-switch-lg mt-1"
                                    checked={advancedOptions.comboStreak}
                                    onChange={(e) => setAdvancedOptions(prev => ({ ...prev, comboStreak: e.target.checked }))}
                                />
                            </div>
                        </Col>

                        {/* 6. Eşleştirme Kartları */}
                        <Col md={6} lg={4}>
                            <div className={`d-flex justify-content-between align-items-start text-body p-3 border rounded-4 transition-all h-100 ${advancedOptions.matchPairs ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-tertiary'}`}>
                                <div>
                                    <div className="fw-bold d-flex align-items-center gap-2 text-success">
                                        <i className="bi bi-controller"></i> Eşleştirme Kartları
                                    </div>
                                    <div className="text-muted small mt-1">Test ekranında, karmaşık gelen İngilizce ve Türkçe kelimeleri birbiriyle eşleştirme oyunu.</div>
                                </div>
                                <FormCheck
                                    type="switch"
                                    className="custom-switch-lg mt-1"
                                    checked={advancedOptions.matchPairs}
                                    onChange={(e) => setAdvancedOptions(prev => ({ ...prev, matchPairs: e.target.checked }))}
                                />
                            </div>
                        </Col>

                        {/* 7. Kademeli İpucu */}
                        <Col md={6} lg={4}>
                            <div className={`d-flex justify-content-between align-items-start text-body p-3 border rounded-4 transition-all h-100 ${advancedOptions.progressiveHint ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-tertiary'}`}>
                                <div>
                                    <div className="fw-bold d-flex align-items-center gap-2 text-warning">
                                        <i className="bi bi-lightbulb"></i> Kademeli İpucu
                                    </div>
                                    <div className="text-muted small mt-1">Zorlandığında "Harf Satın Al" veya ipucu butonları eklenir ancak alacağın puan düşer.</div>
                                </div>
                                <FormCheck
                                    type="switch"
                                    className="custom-switch-lg mt-1"
                                    checked={advancedOptions.progressiveHint}
                                    onChange={(e) => setAdvancedOptions(prev => ({ ...prev, progressiveHint: e.target.checked }))}
                                />
                            </div>
                        </Col>

                        {/* 8. Zamana Karşı Hayatta Kalma */}
                        <Col md={6} lg={4}>
                            <div className={`d-flex justify-content-between align-items-start text-body p-3 border rounded-4 transition-all h-100 ${advancedOptions.timeSurvival ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-tertiary'}`}>
                                <div>
                                    <div className="fw-bold d-flex align-items-center gap-2 text-danger">
                                        <i className="bi bi-stopwatch"></i> Zamana Karşı Hayatta Kalma
                                    </div>
                                    <div className="text-muted small mt-1">Teste ortak bir hız süresiyle başlarsın (Örn: 30sn). Her doğruda +3 saniye kazanırsın.</div>
                                </div>
                                <FormCheck
                                    type="switch"
                                    className="custom-switch-lg mt-1"
                                    checked={advancedOptions.timeSurvival}
                                    onChange={(e) => setAdvancedOptions(prev => ({ ...prev, timeSurvival: e.target.checked }))}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>
            </div>
        </div>
    );
}

export default PracticeTestOptions;
