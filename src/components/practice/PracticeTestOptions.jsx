import React, { useState, useEffect } from 'react';
import { Container, Form, Button, FormCheck, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';

const availableContexts = [
    'Yalın Hal',
    'Geniş Zaman',
    'Geçmiş Zaman',
    'Past Participle',
    'Şimdiki Zaman'
];

function PracticeTestOptions({ words, maxQuestions, onStart, onCancel, savedOptions, onSaveOptions, practiceTests, onResumeTest, onDeleteTest, onDeleteAllTests, onTogglePinTest, customLists }) {
    const [questionCount, setQuestionCount] = useState(Math.min(10, maxQuestions));
    const [onlyStarred, setOnlyStarred] = useState(false);
    const [questionFormat, setQuestionFormat] = useState('mixed'); // 'definition' or 'term' or 'mixed'
    const [shuffle, setShuffle] = useState(true);
    const [excludeStarred, setExcludeStarred] = useState(false);

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
            if (savedOptions.shuffle !== undefined) setShuffle(savedOptions.shuffle);
            if (savedOptions.excludeStarred !== undefined) setExcludeStarred(savedOptions.excludeStarred);
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
            shuffle,
            learningStatus,
            questionTypes,
            advancedOptions,
            selectedLists,
            selectedContexts,
            testHelps,
            excludeStarred
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasLoaded, questionCount, onlyStarred, questionFormat, shuffle, learningStatus, questionTypes, advancedOptions, selectedLists, selectedContexts, excludeStarred, testHelps]);

    // Calculate available questions based on current filters
    const availableWordsCount = (words || []).filter(w => {
        if (onlyStarred && !w.isStarred) return false;
        if (excludeStarred && w.isStarred) return false;
        
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

    const prevMaxRef = React.useRef(maxSelectableCount);
    useEffect(() => {
        if (prevMaxRef.current !== maxSelectableCount) {
            setQuestionCount(Math.max(1, maxSelectableCount));
            prevMaxRef.current = maxSelectableCount;
        } else if (questionCount > maxSelectableCount) {
            const capped = Math.max(1, maxSelectableCount);
            if (questionCount !== capped) {
                setQuestionCount(capped);
            }
        }
    }, [maxSelectableCount, questionCount]);

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
            shuffle,
            learningStatus,
            questionTypes,
            advancedOptions,
            selectedLists,
            selectedContexts,
            testHelps,
            excludeStarred
        });
    };

    return (
        <Container className="py-2 px-md-5 bg-body text-body px-3">
            <div className="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-2 mb-3 sticky-top bg-body py-2 d-md-flex" style={{ zIndex: 10, top: '-1px' }}>
                <div className="d-flex align-items-center gap-2 gap-md-3">
                    <h4 className="fw-bold m-0 text-body d-none d-md-block">Test Seçenekleri</h4>
                    <h5 className="fw-bold m-0 text-body d-md-none">Seçenekler</h5>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <Button variant="info" className="rounded-pill px-3 px-md-4 py-2 fw-bold shadow-sm" onClick={handleStart} style={{ backgroundColor: '#4fd1c5', color: '#1a202c', border: 'none', fontSize: '13px' }}>
                        Teste Başla
                    </Button>
                </div>
            </div>

            <div className="text-body-secondary mx-auto" style={{ maxWidth: '800px' }}>
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
                                const dateObj = test.updatedAt?.toDate ? test.updatedAt.toDate() : new Date(test.updatedAt || test.createdAt || Date.now());
                                const date = dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                                const isCompleted = test.status === 'completed';

                                const total = test.questions?.length || 0;
                                let answeredCount = 0;
                                let correctCount = 0;

                                if (test.questions) {
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
                                        className={`btn bg-body text-body rounded-4 px-2 py-1 fw-medium border text-nowrap d-flex align-items-center gap-2 flex-shrink-0 text-start ${borderClass}`}
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

                <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                    <h6 className="text-body fw-bold mb-3">Test Uzunluğu</h6>
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <span className="text-body small fw-medium">Soru Sayısı</span>
                            <div className="text-muted mt-0" style={{ fontSize: '12px' }}>
                                Seçili ayarlarla {availableWordsCount} kelime bulunuyor.
                                {availableWordsCount > 0 && availableWordsCount < questionCount && (
                                    <span className="text-warning ms-1">Maksimum {availableWordsCount} soru çıkacak.</span>
                                )}
                            </div>
                        </div>
                        <div className="d-flex flex-column align-items-end gap-2">
                            <div className="d-flex align-items-center gap-2">
                                <Form.Control
                                    type="number"
                                    value={questionCount}
                                    onChange={e => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                                    max={Math.max(1, maxSelectableCount)}
                                    min={1}
                                    className="bg-transparent text-body text-center border-secondary border-opacity-50 rounded-pill"
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

                <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                    <h6 className="text-body fw-bold mb-3">Soru Tipleri</h6>
                    <div className="d-flex justify-content-between align-items-center mb-3 text-body">
                        <span>Çoktan Seçmeli (4 Şık)</span>
                        <FormCheck
                            type="switch"
                            id="type-mcq"
                            className="custom-switch-lg"
                            checked={questionTypes.mcq}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, mcq: e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-3 text-body">
                        <span>Doğru / Yanlış</span>
                        <FormCheck
                            type="switch"
                            id="type-tf"
                            className="custom-switch-lg"
                            checked={questionTypes.tf}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, tf: e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-3 text-body">
                        <span className="d-flex align-items-center gap-2">
                            Flash Kart
                        </span>
                        <FormCheck
                            type="switch"
                            id="type-flashcard"
                            className="custom-switch-lg"
                            checked={questionTypes.flashcard}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, flashcard: e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center text-body">
                        <span className="d-flex align-items-center gap-2">
                            Yazarak Cevapla
                        </span>
                        <FormCheck
                            type="switch"
                            id="type-written"
                            className="custom-switch-lg"
                            checked={questionTypes.written}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, written: e.target.checked }))}
                        />
                    </div>
                </div>

                <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                    <h6 className="text-body fw-bold mb-3">Soru Formatı</h6>
                    <div className="d-flex gap-2">
                        {[
                            { key: 'mixed', label: 'Karışık' },
                            { key: 'term', label: 'İngilizce → Türkçe' },
                            { key: 'definition', label: 'Türkçe → İngilizce' }
                        ].map(({ key, label }) => (
                            <Button
                                key={key}
                                type="button"
                                variant={questionFormat === key ? 'primary' : 'outline-secondary'}
                                className={`rounded-pill px-2 py-1 fw-medium flex-grow-1 border-opacity-50`}
                                onClick={() => setQuestionFormat(key)}
                                style={{ fontSize: '12px' }}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                    <div className="mb-2 d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-body-secondary">Öğrenme Durumları</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-2 ms-3 text-body">
                        <span className="d-flex align-items-center gap-2">
                            <i className="bi bi-circle-fill text-primary small" style={{ fontSize: '10px' }}></i> Yeni
                            <Badge bg="secondary" className="bg-opacity-25 text-body rounded-pill ms-1" style={{ fontSize: '12px' }}>{counts.yeni}</Badge>
                        </span>
                        <FormCheck
                            type="switch"
                            className="custom-switch-lg"
                            checked={learningStatus["Yeni"]}
                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Yeni": e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-2 ms-3 text-body">
                        <span className="d-flex align-items-center gap-2">
                            <i className="bi bi-circle-fill text-warning small" style={{ fontSize: '10px' }}></i> Öğreniyor
                            <Badge bg="secondary" className="bg-opacity-25 text-body rounded-pill ms-1" style={{ fontSize: '12px' }}>{counts.ogreniyor}</Badge>
                        </span>
                        <FormCheck
                            type="switch"
                            className="custom-switch-lg"
                            checked={learningStatus["Öğreniyor"]}
                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Öğreniyor": e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-3 ms-3 pb-3 text-body">
                        <span className="d-flex align-items-center gap-2">
                            <i className="bi bi-circle-fill text-success small" style={{ fontSize: '10px' }}></i> Öğrendi
                            <Badge bg="secondary" className="bg-opacity-25 text-body rounded-pill ms-1" style={{ fontSize: '12px' }}>{counts.ogrendi}</Badge>
                        </span>
                        <FormCheck
                            type="switch"
                            className="custom-switch-lg"
                            checked={learningStatus["Öğrendi"]}
                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Öğrendi": e.target.checked }))}
                        />
                    </div>


                    {/* Özel Listeler Section */}
                    {customLists && customLists.length > 0 && (
                        <div className="mt-4 pt-3 border-top border-secondary border-opacity-10 ">
                            <div className="mb-3 d-flex justify-content-between align-items-center">
                                <span className="fw-bold text-body-secondary">Özel Listeler</span>
                            </div>
                            {(() => {
                                const sortedLists = [...customLists].sort((a, b) => {
                                    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                                    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                                    if (orderA !== orderB) return orderA - orderB;
                                    return (new Date(b.createdAt)) - (new Date(a.createdAt));
                                });

                                const listsToDisplay = showAllLists ? sortedLists : sortedLists.slice(0, 5);

                                return (
                                    <>
                                        {listsToDisplay.map(list => (
                                            <div key={list.id} className="d-flex justify-content-between align-items-center mb-2 ms-3 text-body">
                                                <span className="d-flex align-items-center gap-2 text-truncate pe-2">
                                                    <i className="bi bi-collection-play text-info small" style={{ fontSize: '10px' }}></i>
                                                    <span className="text-truncate" style={{ maxWidth: '200px' }}>{list.name}</span>
                                                    <Badge bg="secondary" className="bg-opacity-25 text-body rounded-pill ms-1" style={{ fontSize: '12px' }}>
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

                                        {sortedLists.length > 5 && (
                                            <div className="text-center mt-3">
                                                <Button
                                                    variant="link"
                                                    className="text-decoration-none text-primary fw-bold p-0 d-flex align-items-center gap-1 mx-auto"
                                                    onClick={() => setShowAllLists(!showAllLists)}
                                                    style={{ fontSize: '13px' }}
                                                >
                                                    {showAllLists ? (
                                                        <>Daha Az Göster <i className="bi bi-chevron-up"></i></>
                                                    ) : (
                                                        <>Daha Fazla ({sortedLists.length - 5}) <i className="bi bi-chevron-down"></i></>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    <div className="mt-4 pt-3 border-top border-secondary border-opacity-25">
                        <h6 className="text-body fw-bold mb-3">Yardımlar</h6>
                        <div className="d-flex justify-content-between align-items-center mb-3 text-body">
                            <span>Harf Sayacı</span>
                            <FormCheck
                                type="switch"
                                id="help-counter"
                                className="custom-switch-lg"
                                checked={testHelps.showLetterCounter}
                                onChange={(e) => setTestHelps(prev => ({ ...prev, showLetterCounter: e.target.checked }))}
                            />
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-3 text-body">
                            <span>Uzunluk Eşleşince Yeşil Olsun</span>
                            <FormCheck
                                type="switch"
                                id="help-green"
                                className="custom-switch-lg"
                                checked={testHelps.colorOnLengthMatch}
                                onChange={(e) => setTestHelps(prev => ({ ...prev, colorOnLengthMatch: e.target.checked }))}
                            />
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-0 text-body">
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

                    <div className="d-flex justify-content-between align-items-center mb-3 mt-4 pt-3 text-body  border-top border-secondary border-opacity-25">
                        <span className="d-flex align-items-center gap-2">
                            Sadece Yıldızlı Kelimeleri Çalış <i className="bi bi-star-fill text-warning fs-6"></i>
                            <Badge bg="warning" className="text-dark rounded-pill ms-1" style={{ fontSize: '12px' }}>{counts.starred}</Badge>
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
                    <div className="d-flex justify-content-between align-items-center mb-3 text-body">
                        <span className="d-flex align-items-center gap-2">
                            Yıldızlılar Hariç
                            <i className="bi bi-star text-body-secondary fs-6"></i>
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
                        <span>
                            Kelimeleri Karıştır
                        </span>
                        <FormCheck
                            type="switch"
                            id="option-shuffle"
                            className="custom-switch-lg"
                            checked={shuffle}
                            onChange={(e) => setShuffle(e.target.checked)}
                        />
                    </div>
                </div>

                <div className="mb-4">
                    <h6 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                        Ekstra Modlar <i className="bi bi-fire text-danger"></i>
                    </h6>

                    <div className="d-flex flex-column gap-3">
                        <div className={`p-3 border rounded-3 transition-all ${advancedOptions.fillInTheBlanks ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25'}`}>
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

                        <div className="d-flex justify-content-between align-items-start text-body p-3 border border-secondary border-opacity-25 rounded-3">
                            <div>
                                <div className="fw-medium d-flex align-items-center gap-2">
                                    <i className="bi bi-exclamation-triangle-fill text-warning"></i> Çeldirici Şıklar
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

                        <div className="d-flex justify-content-between align-items-start text-body p-3 border border-secondary border-opacity-25 rounded-3">
                            <div>
                                <div className="fw-medium d-flex align-items-center gap-2">
                                    <i className="bi bi-alphabet text-info"></i> Eksik Harfler (Cellat Modu)
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

                        <div className="d-flex justify-content-between align-items-start text-body p-3 border border-secondary border-opacity-25 rounded-3">
                            <div>
                                <div className="fw-medium d-flex align-items-center gap-2">
                                    <i className="bi bi-mask text-dark"></i> Gizli Anlamlar (Tek Anlam)
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

                        <div className="d-flex justify-content-between align-items-start text-body p-3 border border-secondary border-opacity-25 rounded-3">
                            <div>
                                <div className="fw-medium d-flex align-items-center gap-2">
                                    <i className="bi bi-lightning-charge-fill text-primary"></i> Combo / Seri Çarpanı
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

                        <div className="d-flex justify-content-between align-items-start text-body p-3 border border-secondary border-opacity-25 rounded-3">
                            <div>
                                <div className="fw-medium d-flex align-items-center gap-2">
                                    <i className="bi bi-controller text-success"></i> Eşleştirme Kartları
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

                        <div className="d-flex justify-content-between align-items-start text-body p-3 border border-secondary border-opacity-25 rounded-3">
                            <div>
                                <div className="fw-medium d-flex align-items-center gap-2">
                                    <i className="bi bi-lightbulb text-warning"></i> Kademeli İpucu
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

                        <div className="d-flex justify-content-between align-items-start text-body p-3 border border-secondary border-opacity-25 rounded-3">
                            <div>
                                <div className="fw-medium d-flex align-items-center gap-2">
                                    <i className="bi bi-stopwatch text-danger"></i> Zamana Karşı Hayatta Kalma
                                </div>
                                <div className="text-muted small mt-1">Teste ortak bir hız süresiyle başlarsın (Örn: 30sn). Her doğruda +3 sanine kazanırsın.</div>
                            </div>
                            <FormCheck
                                type="switch"
                                className="custom-switch-lg mt-1"
                                checked={advancedOptions.timeSurvival}
                                onChange={(e) => setAdvancedOptions(prev => ({ ...prev, timeSurvival: e.target.checked }))}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </Container>
    );
}

export default PracticeTestOptions;
