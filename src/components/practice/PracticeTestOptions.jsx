import React, { useState, useEffect } from 'react';
import { Container, Form, Button, FormCheck, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';

function PracticeTestOptions({ words, maxQuestions, onStart, onCancel, savedOptions, onSaveOptions, practiceTests, onResumeTest, onDeleteTest, onDeleteAllTests }) {
    const [questionCount, setQuestionCount] = useState(Math.min(10, maxQuestions));
    const [onlyStarred, setOnlyStarred] = useState(false);
    const [questionFormat, setQuestionFormat] = useState('mixed'); // 'definition' or 'term' or 'mixed'
    const [shuffle, setShuffle] = useState(true);

    // New State for Learning Status
    const [learningStatus, setLearningStatus] = useState({
        "Yeni": true,
        "Öğreniyor": true,
        "Öğrendi": true
    });

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
        timeSurvival: false
    });

    // Track if we've already loaded saved options to avoid re-loading on every savedOptions update
    const hasLoaded = React.useRef(false);

    // Load saved options only once on mount if available
    useEffect(() => {
        if (savedOptions && !hasLoaded.current) {
            hasLoaded.current = true;
            if (savedOptions.questionCount !== undefined) setQuestionCount(savedOptions.questionCount);
            if (savedOptions.onlyStarred !== undefined) setOnlyStarred(savedOptions.onlyStarred);
            if (savedOptions.questionFormat !== undefined) setQuestionFormat(savedOptions.questionFormat);
            if (savedOptions.shuffle !== undefined) setShuffle(savedOptions.shuffle);
            if (savedOptions.learningStatus !== undefined) setLearningStatus(savedOptions.learningStatus);
            if (savedOptions.questionTypes !== undefined) setQuestionTypes(savedOptions.questionTypes);
            if (savedOptions.advancedOptions !== undefined) setAdvancedOptions(savedOptions.advancedOptions);
        }
    }, [savedOptions]);

    // Save options when they change (onSaveOptions is a stable setter, excluded from deps intentionally)
    useEffect(() => {
        if (!onSaveOptions || !hasLoaded.current) return;
        onSaveOptions({
            questionCount,
            onlyStarred,
            questionFormat,
            shuffle,
            learningStatus,
            questionTypes,
            advancedOptions
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionCount, onlyStarred, questionFormat, shuffle, learningStatus, questionTypes, advancedOptions]);

    // Calculate available questions based on current filters
    const availableWordsCount = (words || []).filter(w => {
        if (onlyStarred && !w.isStarred) return false;
        if (learningStatus && !learningStatus[w.learningStatus || 'Yeni']) return false;
        return true;
    }).length;

    const counts = {
        yeni: (words || []).filter(w => (w.learningStatus || 'Yeni') === 'Yeni').length,
        ogreniyor: (words || []).filter(w => w.learningStatus === 'Öğreniyor').length,
        ogrendi: (words || []).filter(w => w.learningStatus === 'Öğrendi').length,
        starred: (words || []).filter(w => w.isStarred).length
    };

    const maxSelectableCount = Math.min(availableWordsCount, maxQuestions);

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
            questionCount: Math.min(questionCount, maxQuestions),
            onlyStarred,
            questionFormat,
            shuffle,
            learningStatus,
            questionTypes,
            advancedOptions
        });
    };

    return (
        <Container className="py-2 px-md-5 bg-body text-body">
            <div className="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-2 mb-3 sticky-top bg-body py-2" style={{ zIndex: 10 }}>
                <div className="d-flex align-items-center gap-3">
                    <Button variant="link" className="p-0 text-muted" onClick={onCancel}>
                        <i className="bi bi-arrow-left fs-4"></i>
                    </Button>
                    <h2 className="fw-bold m-0 text-body">Test Seçenekleri</h2>
                </div>
                <Button variant="info" className="rounded-pill px-4 fw-bold" onClick={handleStart} style={{ backgroundColor: '#4fd1c5', color: '#1a202c', border: 'none', fontSize: '14px' }}>
                    Teste Başla
                </Button>
            </div>

            <div className="text-body-secondary mx-auto" style={{ maxWidth: '800px' }}>
                {practiceTests && practiceTests.length > 0 && (
                    <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="text-body fw-bold mb-0">Tamamlanmış & Devam Eden Testler</h5>
                            <Button variant="outline-danger" size="sm" className="rounded-pill px-3 fw-bold" onClick={() => {
                                Swal.fire({
                                    title: 'Tümünü Sil',
                                    text: 'Tüm sınav geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonText: 'Evet, Sil',
                                    cancelButtonText: 'İptal',
                                    confirmButtonColor: '#d33',
                                }).then(result => {
                                    if (result.isConfirmed && onDeleteAllTests) {
                                        onDeleteAllTests();
                                    }
                                });
                            }}>
                                Tümünü Sil
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
                                        className={`btn bg-body text-body rounded-4 px-3 py-2 fw-medium border text-nowrap d-flex align-items-center gap-3 flex-shrink-0 text-start ${borderClass}`}
                                        onClick={() => onResumeTest(test.id)}
                                        style={{ fontSize: '14px', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
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
                                            className="ms-1 d-flex align-items-center"
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
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                    <h5 className="text-body fw-bold mb-3">Test Uzunluğu</h5>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <span className="text-body">Soru Sayısı</span>
                            <div className="text-muted mt-1" style={{ fontSize: '14px' }}>
                                Seçili ayarlarla {availableWordsCount} kelime bulunuyor.
                                {availableWordsCount > 0 && availableWordsCount < questionCount && (
                                    <span className="text-warning ms-1">Maksimum {availableWordsCount} soru çıkacak.</span>
                                )}
                            </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <Form.Control
                                type="number"
                                value={questionCount}
                                onChange={e => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                                max={maxQuestions}
                                min={1}
                                className="bg-transparent text-body text-center border-secondary border-opacity-50 rounded-pill"
                                style={{ width: '80px', fontSize: '14px' }}
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
                    </div>
                </div>

                <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                    <h5 className="text-body fw-bold mb-3">Soru Tipleri</h5>
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
                    <h5 className="text-body fw-bold mb-3">Soru Formatı</h5>
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
                                className={`rounded-pill px-3 py-2 fw-medium flex-grow-1 border-opacity-50`}
                                onClick={() => setQuestionFormat(key)}
                                style={{ fontSize: '14px' }}
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

                    <div className="d-flex justify-content-between align-items-center mb-3 mt-2 text-body">
                        <span className="d-flex align-items-center gap-2">
                            Sadece Yıldızlı Kelimeleri Çalış <i className="bi bi-star-fill text-warning fs-6"></i>
                            <Badge bg="warning" className="text-dark rounded-pill ms-1" style={{ fontSize: '12px' }}>{counts.starred}</Badge>
                        </span>
                        <FormCheck
                            type="switch"
                            id="option-starred"
                            className="custom-switch-lg"
                            checked={onlyStarred}
                            onChange={(e) => setOnlyStarred(e.target.checked)}
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
                    <h5 className="text-body fw-bold mb-3 d-flex align-items-center gap-2">
                        Ekstra Zorlaştırıcı & Eğlenceli Modlar <i className="bi bi-fire text-danger"></i>
                    </h5>
                    
                    <div className="d-flex flex-column gap-3">
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
