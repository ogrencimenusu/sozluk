import React, { useState, useEffect } from 'react';
import { Container, Form, Button, FormCheck, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';

function PracticeTestOptions({ words, maxQuestions, onStart, onCancel, savedOptions, onSaveOptions }) {
    const [questionCount, setQuestionCount] = useState(Math.min(10, maxQuestions));
    const [onlyStarred, setOnlyStarred] = useState(false);
    const [questionFormat, setQuestionFormat] = useState('definition'); // 'definition' or 'term'
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
            questionTypes
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionCount, onlyStarred, questionFormat, shuffle, learningStatus, questionTypes]);

    // Calculate available questions based on current filters
    const availableWordsCount = (words || []).filter(w => {
        if (onlyStarred && !w.isStarred) return false;
        if (learningStatus && !learningStatus[w.learningStatus || 'Yeni']) return false;
        return true;
    }).length;

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
            questionTypes
        });
    };

    return (
        <Container className="py-4 px-md-5 bg-body text-body">
            <div className="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-3 mb-4">
                <div className="d-flex align-items-center gap-3">
                    <Button variant="link" className="p-0 text-muted" onClick={onCancel}>
                        <i className="bi bi-arrow-left fs-4"></i>
                    </Button>
                    <h2 className="fw-bold m-0 text-body">Test Seçenekleri</h2>
                </div>
                <Button variant="info" className="rounded-pill px-4 fw-bold" onClick={handleStart} style={{ backgroundColor: '#4fd1c5', color: '#1a202c', border: 'none' }}>
                    Teste Başla
                </Button>
            </div>

            <div className="text-body-secondary mx-auto" style={{ maxWidth: '800px' }}>
                <div className="mb-5 pb-4 border-bottom border-secondary border-opacity-25">
                    <h5 className="text-body fw-bold mb-4">Test Uzunluğu</h5>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <span className="fs-5 text-body">Soru Sayısı</span>
                            <div className="text-muted small mt-1">
                                Seçili ayarlarla {availableWordsCount} kelime bulunuyor.
                                {availableWordsCount > 0 && availableWordsCount < questionCount && (
                                    <span className="text-warning ms-1">Maksimum {availableWordsCount} soru çıkacak.</span>
                                )}
                            </div>
                        </div>
                        <Form.Control
                            type="number"
                            value={questionCount}
                            onChange={e => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                            max={maxQuestions}
                            min={1}
                            className="bg-transparent text-body text-center border-secondary border-opacity-50 rounded-pill"
                            style={{ width: '80px' }}
                        />
                    </div>
                </div>

                <div className="mb-5 pb-4 border-bottom border-secondary border-opacity-25">
                    <h5 className="text-body fw-bold mb-4">Soru Tipleri</h5>
                    <div className="d-flex justify-content-between align-items-center mb-4 text-body">
                        <span className="fs-5">Çoktan Seçmeli (4 Şık)</span>
                        <FormCheck
                            type="switch"
                            id="type-mcq"
                            className="custom-switch-lg"
                            checked={questionTypes.mcq}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, mcq: e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-4 text-body">
                        <span className="fs-5">Doğru / Yanlış</span>
                        <FormCheck
                            type="switch"
                            id="type-tf"
                            className="custom-switch-lg"
                            checked={questionTypes.tf}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, tf: e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-4 text-body">
                        <span className="fs-5 d-flex align-items-center gap-2">
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
                        <span className="fs-5 d-flex align-items-center gap-2">
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

                <div className="mb-5 pb-4 border-bottom border-secondary border-opacity-25">
                    <h5 className="text-body fw-bold mb-4">Soru Formatı</h5>
                    <div className="d-flex justify-content-between align-items-center mb-4 text-body">
                        <span className="fs-5 d-flex align-items-center gap-2">
                            Kelime ile Sorup Anlam İsteme <i className="bi bi-question-circle text-muted fs-6" title="Soru olarak İngilizce kelime çıkacak"></i>
                        </span>
                        <FormCheck
                            type="switch"
                            id="format-term"
                            className="custom-switch-lg"
                            checked={questionFormat === 'term'}
                            onChange={() => setQuestionFormat('term')}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center text-body">
                        <span className="fs-5 d-flex align-items-center gap-2">
                            Anlamı ile Sorup Kelime İsteme <i className="bi bi-question-circle text-muted fs-6" title="Soru olarak Türkçe anlam çıkacak"></i>
                        </span>
                        <FormCheck
                            type="switch"
                            id="format-definition"
                            className="custom-switch-lg"
                            checked={questionFormat === 'definition'}
                            onChange={() => setQuestionFormat('definition')}
                        />
                    </div>
                </div>

                <div className="mb-4">
                    <h5 className="text-body fw-bold mb-4">Öğrenme Seçenekleri</h5>

                    <div className="mb-4 d-flex justify-content-between align-items-center">
                        <span className="fs-5 fw-bold text-body-secondary">Öğrenme Durumları</span>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-3 ms-3 text-body">
                        <span className="fs-6 d-flex align-items-center gap-2">
                            <i className="bi bi-circle-fill text-primary small"></i> Yeni
                        </span>
                        <FormCheck
                            type="switch"
                            className="custom-switch-lg"
                            checked={learningStatus["Yeni"]}
                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Yeni": e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-3 ms-3 text-body">
                        <span className="fs-6 d-flex align-items-center gap-2">
                            <i className="bi bi-circle-fill text-warning small"></i> Öğreniyor
                        </span>
                        <FormCheck
                            type="switch"
                            className="custom-switch-lg"
                            checked={learningStatus["Öğreniyor"]}
                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Öğreniyor": e.target.checked }))}
                        />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-4 ms-3 border-bottom border-secondary border-opacity-25 pb-4 text-body">
                        <span className="fs-6 d-flex align-items-center gap-2">
                            <i className="bi bi-circle-fill text-success small"></i> Öğrendi
                        </span>
                        <FormCheck
                            type="switch"
                            className="custom-switch-lg"
                            checked={learningStatus["Öğrendi"]}
                            onChange={(e) => setLearningStatus(prev => ({ ...prev, "Öğrendi": e.target.checked }))}
                        />
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-4 mt-2 text-body">
                        <span className="fs-5 d-flex align-items-center gap-2">
                            Sadece Yıldızlı Kelimeleri Çalış <i className="bi bi-star-fill text-warning fs-6"></i>
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
                        <span className="fs-5">
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
            </div>
        </Container>
    );
}

export default PracticeTestOptions;
