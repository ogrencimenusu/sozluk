import React, { useState, useRef, useEffect } from 'react';
import { Container, Button, Row, Col, Card, Badge, OverlayTrigger, Popover } from 'react-bootstrap';
import WordDetailModal from './WordDetailModal';
import LearningStageBar from '../LearningStageBar';
import Swal from 'sweetalert2';

function PracticeTestActive({ questions, words, onClose, onHome, onFinish, onUpdateStage, onToggleStar, onDelete, onRetakeSame, onRetakeNew, onRetakeMissed }) {
    const [answers, setAnswers] = useState({}); // { [questionIdx]: { selected: OptionObj } }
    const [writtenInputs, setWrittenInputs] = useState({}); // { [questionIdx]: string } for 'written' type
    const [completed, setCompleted] = useState(false);
    const [flippedCards, setFlippedCards] = useState({}); // { [questionIdx]: true/false }
    const [detailWord, setDetailWord] = useState(null); // word to show in detail modal
    const [hintsUsed, setHintsUsed] = useState({}); // { [questionIdx]: count }
    const [hiddenOptions, setHiddenOptions] = useState({}); // { [questionIdx]: [optionIndex, ...] }

    // Refs for scrolling to questions
    const questionRefs = useRef([]);
    const submitBtnRef = useRef(null);

    // Prevent accidental reload/leave if test has started
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            let hasAnswers = false;
            for (let idx = 0; idx < questions.length; idx++) {
                if (answers[idx] || (questions[idx].type === 'written' && (writtenInputs[idx] || '').trim().length > 0)) {
                    hasAnswers = true;
                    break;
                }
            }

            if (hasAnswers && !completed) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [answers, writtenInputs, completed, questions]);

    const flipCard = (idx) => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }));

    const handleSelectAnswer = (qIdx, optionObj) => {
        if (completed) return; // Prevent changing answers after completion

        setAnswers(prev => {
            const currentAnswer = prev[qIdx];
            if (currentAnswer && currentAnswer.selected.text === optionObj.text) {
                // If clicking the same option, deselect it
                const newAnswers = { ...prev };
                delete newAnswers[qIdx];
                return newAnswers;
            }

            const newAnswers = { ...prev, [qIdx]: { selected: optionObj } };

            const hasUnanswered = questions.some((q, i) => !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

            if (!hasUnanswered) {
                setTimeout(() => {
                    if (submitBtnRef.current) {
                        submitBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            } else {
                let nextUnansweredIdx = questions.findIndex((q, i) => i > qIdx && !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

                if (nextUnansweredIdx === -1) {
                    nextUnansweredIdx = questions.findIndex((q, i) => !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));
                }

                if (nextUnansweredIdx !== -1 && questionRefs.current[nextUnansweredIdx]) {
                    setTimeout(() => {
                        questionRefs.current[nextUnansweredIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300); // slight delay to show selection
                }
            }

            return newAnswers;
        });
    };

    const handleWrittenSubmit = (qIdx, correctAnswer) => {
        if (completed || !!answers[qIdx]) return;
        const typed = (writtenInputs[qIdx] || '').trim().toLowerCase();
        const correct = correctAnswer.trim().toLowerCase();
        const isCorrect = typed === correct;
        setAnswers(prev => {
            const newAnswers = { ...prev, [qIdx]: { selected: { text: writtenInputs[qIdx] || '', isCorrect } } };

            const hasUnanswered = questions.some((q, i) => !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

            if (!hasUnanswered) {
                setTimeout(() => {
                    if (submitBtnRef.current) {
                        submitBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            } else {
                let nextUnansweredIdx = questions.findIndex((q, i) => i > qIdx && !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

                if (nextUnansweredIdx === -1) {
                    nextUnansweredIdx = questions.findIndex((q, i) => !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));
                }

                if (nextUnansweredIdx !== -1 && questionRefs.current[nextUnansweredIdx]) {
                    setTimeout(() => {
                        questionRefs.current[nextUnansweredIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                }
            }

            return newAnswers;
        });
    };

    const handleHintClick = (idx, q) => {
        if (completed || !!answers[idx]) return;

        const currentHints = hintsUsed[idx] || 0;
        const isMcq = q.type !== 'tf' && q.type !== 'written' && q.type !== 'flashcard' && q.options && q.options.length > 0;

        if (isMcq) {
            const incorrectOptions = q.options.filter(opt => !opt.isCorrect);
            const hiddenForQ = hiddenOptions[idx] || [];

            if (hiddenForQ.length < incorrectOptions.length - 1) {
                const availableToHide = q.options.map((opt, i) => ({ opt, i })).filter(item => !item.opt.isCorrect && !hiddenForQ.includes(item.i));
                if (availableToHide.length > 0) {
                    const toHide = availableToHide[Math.floor(Math.random() * availableToHide.length)].i;
                    setHiddenOptions(prev => ({ ...prev, [idx]: [...hiddenForQ, toHide] }));
                    setHintsUsed(prev => ({ ...prev, [idx]: currentHints + 1 }));
                }
            }
        } else {
            if (currentHints < 3) {
                setHintsUsed(prev => ({ ...prev, [idx]: currentHints + 1 }));
            }
        }
    };

    const handleSpeak = (text) => {
        if (!('speechSynthesis' in window)) return;

        const speak = (voices) => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;

            const englishVoice =
                voices.find(v => v.name.includes('Google US English')) ||
                voices.find(v => v.name.includes('Samantha')) ||
                voices.find(v => v.name.includes('Alex')) ||
                voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB') ||
                voices.find(v => v.lang.startsWith('en-'));

            if (englishVoice) utterance.voice = englishVoice;
            window.speechSynthesis.speak(utterance);
        };

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            speak(voices);
        } else {
            window.speechSynthesis.addEventListener('voiceschanged', () => {
                speak(window.speechSynthesis.getVoices());
            }, { once: true });
        }
    };

    const scrollToQuestion = (idx) => {
        if (questionRefs.current[idx]) {
            questionRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleClose = async () => {
        const exitFn = onHome || onClose;
        if (!completed && Object.keys(answers).length > 0) {
            const result = await Swal.fire({
                title: 'Testi bırakmak istiyor musunuz?',
                text: `${Object.keys(answers).length} soruyu cevapladınız. İlerlemeniz kaydedilmeyecek.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Evet, çık',
                cancelButtonText: 'Devam et'
            });
            if (!result.isConfirmed) return;
        }
        exitFn();
    };

    const handleOptions = async () => {
        if (!completed && Object.keys(answers).length > 0) {
            const result = await Swal.fire({
                title: 'Seçeneklere dönmek istiyor musunuz?',
                text: `${Object.keys(answers).length} soruyu cevapladınız. İlerlemeniz kaydedilmeyecek.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Evet, dön',
                cancelButtonText: 'Devam et'
            });
            if (!result.isConfirmed) return;
        }
        onClose();
    };

    const getAnsweredCount = () => {
        let count = 0;
        questions.forEach((q, idx) => {
            if (answers[idx]) {
                count++;
            } else if (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0) {
                count++;
            }
        });
        return count;
    };

    const handleSubmit = async () => {
        const answeredCount = getAnsweredCount();
        if (answeredCount < questions.length) {
            const result = await Swal.fire({
                title: 'Emin misiniz?',
                text: 'Tüm soruları cevaplamadınız. Yine de testi bitirmek istiyor musunuz?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ffc107',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Evet, bitir',
                cancelButtonText: 'İptal'
            });
            if (!result.isConfirmed) {
                return;
            }
        }

        // Auto-grade written inputs and unanswered text
        const finalAnswers = { ...answers };
        questions.forEach((q, idx) => {
            if (!finalAnswers[idx]) {
                if (q.type === 'written') {
                    const typed = (writtenInputs[idx] || '').trim();
                    const correct = q.answer.trim();
                    const isCorrect = typed.toLowerCase() === correct.toLowerCase() && typed.length > 0;
                    finalAnswers[idx] = { selected: { text: typed || 'Boş bırakıldı', isCorrect } };
                } else {
                    finalAnswers[idx] = { selected: { text: 'Boş bırakıldı', isCorrect: false } };
                }
            }
        });

        setAnswers(finalAnswers);
        setCompleted(true);

        // Update learning stages for each answered question
        if (onUpdateStage) {
            const updatePromises = questions.map((q, idx) => {
                const isCorrect = finalAnswers[idx]?.selected?.isCorrect;
                return onUpdateStage(q.wordId, isCorrect);
            });
            await Promise.all(updatePromises);
        }

        // Scroll to top to see results summary
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const correctCount = completed ? questions.filter((q, idx) => answers[idx]?.selected?.isCorrect).length : 0;
    const allAnswered = getAnsweredCount() === questions.length;

    const skippedCount = completed ? questions.filter((q, idx) => answers[idx]?.selected?.text === 'Boş bırakıldı').length : 0;
    const incorrectCount = completed ? (questions.length - correctCount - skippedCount) : 0;
    const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const missedQuestions = completed ? questions.filter((q, idx) => !answers[idx]?.selected?.isCorrect) : [];

    // Calculate Stage Metrics based on all words in the dictionary
    const stageMetrics = React.useMemo(() => {
        let yeni = 0;
        let ogreniyor = 0;
        let ogrendi = 0;

        if (completed && words?.length > 0) {
            words.forEach(word => {
                // Map learningStage (0-10) to statuses
                const s = word.learningStage || 0;
                if (s === 0) {
                    yeni++;
                } else if (s < 10) {
                    ogreniyor++;
                } else {
                    ogrendi++;
                }
            });
        }

        const total = words?.length || 1; // avoid / 0
        return {
            yeni,
            ogreniyor,
            ogrendi,
            yeniPercent: Math.round((yeni / total) * 100),
            ogreniyorPercent: Math.round((ogreniyor / total) * 100),
            ogrendiPercent: Math.round((ogrendi / total) * 100)
        };
    }, [completed, words]);

    return (
        <>
            <Container fluid className="py-4 h-100 bg-body">
                <div className="d-flex justify-content-between align-items-center mb-4 px-md-4 sticky-top bg-body py-2 z-index-10 border-bottom border-secondary border-opacity-25 pb-3">
                    <div className="d-flex align-items-center gap-2">
                        <img src="/iconv2.png" alt="Sözlük Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                        <span className="fw-bold fs-5 text-body">Sözlük</span>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        <div className="bg-body-tertiary border border-secondary border-opacity-50 rounded-pill px-3 py-1 text-body fw-bold d-flex align-items-center gap-2" title="Soru Sayısı">
                            <i className="bi bi-pencil-fill text-info"></i> {questions.length}
                        </div>
                        <Button variant="outline-secondary" className="rounded-pill px-3 py-1" onClick={handleOptions}>Seçenekler</Button>
                        <Button variant="outline-secondary" className="rounded-circle d-flex align-items-center justify-content-center p-0" style={{ width: '36px', height: '36px' }} onClick={handleClose}>
                            <i className="bi bi-x fs-5 text-body"></i>
                        </Button>
                    </div>
                </div>

                <Row className="px-md-4 h-100 position-relative">
                    {/* SIDEBAR: Question Navigation Map */}
                    <Col md={3} lg={2} className="mb-4 mb-md-0 d-none d-md-block" style={{ position: 'sticky', top: '100px', height: 'fit-content' }}>
                        <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-3 shadow-none text-body">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <span className="fw-bold">Sorular</span>
                                <Button variant="link" className="p-0 text-body-secondary"><i className="bi bi-chevron-double-left"></i></Button>
                            </div>
                            <div className="d-flex flex-wrap gap-2 justify-content-start pb-4">
                                {questions.map((q, idx) => {
                                    const isAnswered = !!answers[idx] || (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0);

                                    let btnClass = "btn btn-sm rounded-circle fw-bold border-secondary border-opacity-50 ";

                                    if (completed) {
                                        // Show correct/incorrect in navigation map if completed
                                        const isCorrect = answers[idx]?.selected?.isCorrect;
                                        btnClass += isCorrect ? "bg-success text-white border-success" : (isAnswered ? "bg-danger text-white border-danger" : "bg-transparent text-body-secondary");
                                    } else {
                                        // Just show answered state
                                        btnClass += isAnswered ? "bg-info text-dark border-info" : "bg-transparent text-body-secondary";
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            className={btnClass}
                                            style={{ width: '36px', height: '36px', padding: 0 }}
                                            onClick={() => scrollToQuestion(idx)}
                                            title={`Soru ${idx + 1}`}
                                        >
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    </Col>

                    {/* MAIN CONTENT: Questions List */}
                    <Col md={9} lg={8} className="mx-auto pb-5">

                        {/* Results / Score Summary Header */}
                        {completed && (
                            <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-4 shadow-sm mb-5 text-start" style={{ borderTop: '4px solid #198754' }}>
                                <Row className="align-items-center">
                                    <Col lg={5} className="d-flex flex-column gap-3">
                                        <h5 className="fw-bold text-body mb-0">Test Başarı Oranı</h5>
                                        <div className="d-flex align-items-center gap-4">
                                            {/* Circular Progress */}
                                            <div className="position-relative flex-shrink-0" style={{ width: '130px', height: '130px' }}>
                                                <svg width="130" height="130" viewBox="0 0 130 130">
                                                    <circle cx="65" cy="65" r="52" fill="transparent" stroke="var(--bs-secondary-bg)" strokeWidth="10" />
                                                    <circle cx="65" cy="65" r="52" fill="transparent" stroke="#20c997" strokeWidth="10" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 - (scorePercent / 100) * (2 * Math.PI * 52)} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s ease-in-out' }} />
                                                </svg>
                                                <div className="position-absolute top-50 start-50 translate-middle fw-bold display-6 text-body">
                                                    {scorePercent}%
                                                </div>
                                            </div>

                                            {/* Metrics list */}
                                            <div className="d-flex flex-column gap-2 flex-grow-1">
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="rounded-circle bg-success bg-opacity-25 text-success d-flex align-items-center justify-content-center fw-bold" style={{ width: '28px', height: '28px', fontSize: '13px' }}>{correctCount}</div>
                                                    <span className="fw-medium text-body-secondary">Doğru</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="rounded-circle bg-danger bg-opacity-25 text-danger d-flex align-items-center justify-content-center fw-bold" style={{ width: '28px', height: '28px', fontSize: '13px' }}>{incorrectCount}</div>
                                                    <span className="fw-medium text-body-secondary">Yanlış</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="rounded-circle bg-secondary bg-opacity-25 text-secondary d-flex align-items-center justify-content-center fw-bold" style={{ width: '28px', height: '28px', fontSize: '13px' }}>{skippedCount}</div>
                                                    <span className="fw-medium text-body-secondary">Boş bırakıldı</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Col>

                                    <Col lg={7} className="border-start-lg border-secondary border-opacity-25 ps-lg-4 mt-4 mt-lg-0">
                                        <div className="d-flex flex-column gap-2 mt-2">
                                            <Button variant="outline-success" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-success bg-opacity-10 border-success border-opacity-50 border-2 transition-all hover-opacity-75" onClick={onRetakeSame}>
                                                <div>
                                                    <div className="fw-bold text-success mb-1">Aynı testi yeniden çöz</div>
                                                    <small className="text-body-secondary">Mevcut testi birebir baştan tekrarla.</small>
                                                </div>
                                                <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 36, height: 36 }}><i className="bi bi-arrow-right fw-bold text-body fs-5"></i></div>
                                            </Button>

                                            {missedQuestions.length > 0 && (
                                                <Button variant="outline-warning" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-warning bg-opacity-10 border-warning border-opacity-50 border-2 transition-all hover-opacity-75" onClick={() => onRetakeMissed(missedQuestions)}>
                                                    <div>
                                                        <div className="fw-bold text-warning-emphasis mb-1">Yanlış cevapları tekrarla</div>
                                                        <small className="text-body-secondary">Sadece {missedQuestions.length} yanlış ve boş soruyu çöz.</small>
                                                    </div>
                                                    <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 36, height: 36 }}><i className="bi bi-arrow-right fw-bold text-body fs-5"></i></div>
                                                </Button>
                                            )}

                                            <Button variant="outline-primary" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-body-secondary border-secondary border-opacity-25 border-2 transition-all hover-opacity-75" onClick={onRetakeNew}>
                                                <div>
                                                    <div className="fw-bold text-body mb-1">Yeni test çöz</div>
                                                    <small className="text-body-secondary">Mevcut ayarlarla farklı kelimeler sorulsun.</small>
                                                </div>
                                                <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 36, height: 36 }}><i className="bi bi-arrow-right fw-bold text-body fs-5"></i></div>
                                            </Button>


                                        </div>
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Studying Progress Section */}
                        {completed && (
                            <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-4 shadow-sm mb-5 text-start">
                                <Row className="align-items-center mb-4">
                                    <Col>
                                        <h5 className="fw-bold text-body mb-0">Çalışma Durumu</h5>
                                        <small className="text-body-secondary">Tüm kelimelerinizin genel durumu</small>
                                    </Col>
                                    <Col xs="auto">
                                        <div className="bg-secondary bg-opacity-25 text-body fw-bold rounded-pill px-3 py-1">
                                            {stageMetrics.ogrendiPercent}%
                                        </div>
                                    </Col>
                                </Row>

                                <div className="d-flex flex-column gap-3">
                                    {/* Yeni */}
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="flex-grow-1 position-relative" style={{ height: '36px' }}>
                                            {/* Background Base */}
                                            <div className="w-100 h-100 rounded-pill" style={{ backgroundColor: 'rgba(214, 51, 132, 0.1)' }}></div>
                                            {/* Fill */}
                                            <div className="h-100 rounded-pill position-absolute top-0 start-0 d-flex align-items-center ps-3 text-danger whitespace-nowrap overflow-hidden transition-all" style={{ backgroundColor: 'rgba(214, 51, 132, 0.2)', width: `${Math.max(15, stageMetrics.yeniPercent)}%`, border: '1px solid rgba(214, 51, 132, 0.4)' }}>
                                                <i className="bi bi-circle me-2 fw-bold" style={{ color: '#d63384' }}></i>
                                                <span className="fw-bold" style={{ color: '#d63384' }}>Yeni Kelimeler</span>
                                            </div>
                                        </div>
                                        <div className="fw-bold text-body" style={{ minWidth: '40px', textAlign: 'right' }}>
                                            {stageMetrics.yeni}
                                        </div>
                                    </div>

                                    {/* Öğreniyor */}
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="flex-grow-1 position-relative" style={{ height: '36px' }}>
                                            {/* Background Base */}
                                            <div className="w-100 h-100 rounded-pill" style={{ backgroundColor: 'rgba(111, 66, 193, 0.1)' }}></div>
                                            {/* Fill */}
                                            <div className="h-100 rounded-pill position-absolute top-0 start-0 d-flex align-items-center ps-3 text-purple whitespace-nowrap overflow-hidden transition-all" style={{ backgroundColor: 'rgba(111, 66, 193, 0.2)', width: `${Math.max(15, stageMetrics.ogreniyorPercent)}%`, border: '1px solid rgba(111, 66, 193, 0.4)' }}>
                                                <i className="bi bi-circle-half me-2 fw-bold" style={{ color: '#6f42c1' }}></i>
                                                <span className="fw-bold" style={{ color: '#6f42c1' }}>Öğreniliyor</span>
                                            </div>
                                        </div>
                                        <div className="fw-bold text-body" style={{ minWidth: '40px', textAlign: 'right' }}>
                                            {stageMetrics.ogreniyor}
                                        </div>
                                    </div>

                                    {/* Öğrendi */}
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="flex-grow-1 position-relative" style={{ height: '36px' }}>
                                            {/* Background Base */}
                                            <div className="w-100 h-100 rounded-pill" style={{ backgroundColor: 'rgba(32, 201, 151, 0.1)' }}></div>
                                            {/* Fill */}
                                            <div className="h-100 rounded-pill position-absolute top-0 start-0 d-flex align-items-center ps-3 text-success whitespace-nowrap overflow-hidden transition-all" style={{ backgroundColor: 'rgba(32, 201, 151, 0.2)', width: `${Math.max(15, stageMetrics.ogrendiPercent)}%`, border: '1px solid rgba(32, 201, 151, 0.4)' }}>
                                                <i className="bi bi-check-circle me-2 fw-bold" style={{ color: '#20c997' }}></i>
                                                <span className="fw-bold" style={{ color: '#20c997' }}>Öğrenildi</span>
                                            </div>
                                        </div>
                                        <div className="fw-bold text-body" style={{ minWidth: '40px', textAlign: 'right' }}>
                                            {stageMetrics.ogrendi}
                                        </div>
                                    </div>

                                </div>
                            </Card>
                        )}

                        <div className="d-flex flex-column gap-5">
                            {questions.map((currentQuestion, idx) => (
                                <div key={idx} ref={el => questionRefs.current[idx] = el} style={{ scrollMarginTop: '120px' }}>
                                    <Card className={`bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-4 shadow-none ${completed && !answers[idx]?.selected?.isCorrect ? 'border-opacity-100 border-danger' : ''}`}>
                                        <div className="d-flex justify-content-between align-items-start mb-4">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="bg-secondary bg-opacity-25 text-body rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: 28, height: 28, fontSize: '14px' }}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-body-secondary fw-semibold">
                                                    {currentQuestion.format === 'definition' ? 'Anlam' : 'Kelime'}
                                                </span>
                                            </div>
                                            <div className="d-flex gap-2 align-items-center flex-wrap justify-content-end">
                                                {(() => {
                                                    const wordObj = (words || []).find(w => w.id === currentQuestion.wordId);
                                                    const stage = wordObj?.learningStage ?? 0;
                                                    return (
                                                        <div className="d-flex align-items-center gap-2" style={{ minWidth: '110px' }}>
                                                            {wordObj && onToggleStar && (
                                                                <button
                                                                    className="btn btn-link p-0 border-0 text-decoration-none"
                                                                    onClick={(e) => onToggleStar(e, wordObj)}
                                                                    title={wordObj.isStarred ? "Yıldızı Kaldır" : "Yıldız Ekle"}
                                                                >
                                                                    <i className={`fs-5 bi ${wordObj.isStarred ? 'bi-star-fill text-warning' : 'bi-star text-secondary'}`}></i>
                                                                </button>
                                                            )}
                                                            <div className="flex-grow-1">
                                                                <LearningStageBar stage={stage} showLabel />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                {(() => {
                                                    const wordObj = (words || []).find(w => w.id === currentQuestion.wordId);

                                                    const isMcq = currentQuestion.type !== 'tf' && currentQuestion.type !== 'written' && currentQuestion.type !== 'flashcard' && currentQuestion.options;
                                                    const maxHints = isMcq ? Math.max(0, (currentQuestion.options?.filter(o => !o.isCorrect).length || 0) - 1) : (currentQuestion.type === 'tf' ? 0 : 3);
                                                    const currentHints = hintsUsed[idx] || 0;
                                                    const canHint = !completed && !answers[idx] && currentHints < maxHints;

                                                    const popover = (
                                                        <Popover id={`popover-hint-${idx}`}>
                                                            <Popover.Header as="h3">İpucu <i className="bi bi-lightbulb text-warning"></i></Popover.Header>
                                                            <Popover.Body>
                                                                {currentHints === 0 ? (
                                                                    canHint ? "İpucu almak için butona tıklayın." : "İpucu kalmadı."
                                                                ) : isMcq ? (
                                                                    `${currentHints} yanlış şık elendi!`
                                                                ) : (
                                                                    <ul className="mb-0 ps-3">
                                                                        {currentHints >= 1 && currentQuestion.answer?.length > 0 && <li>İlk harf: <strong className="text-primary">{currentQuestion.answer[0].toUpperCase()}</strong></li>}
                                                                        {currentHints >= 2 && currentQuestion.answer?.length > 1 && <li>Son harf: <strong className="text-primary">{currentQuestion.answer[currentQuestion.answer.length - 1].toUpperCase()}</strong></li>}
                                                                        {currentHints >= 3 && currentQuestion.answer?.length > 0 && <li>Harf sayısı: <strong className="text-primary">{currentQuestion.answer?.length}</strong></li>}
                                                                    </ul>
                                                                )}
                                                            </Popover.Body>
                                                        </Popover>
                                                    );

                                                    return (
                                                        <div className="d-flex gap-2">
                                                            {maxHints > 0 && (
                                                                <OverlayTrigger trigger={['hover', 'focus']} placement="top" overlay={popover}>
                                                                    <span className="d-inline-block">
                                                                        <Button
                                                                            variant="outline-warning"
                                                                            size="sm"
                                                                            className="rounded-pill px-3 py-1 d-flex align-items-center gap-1 border-opacity-75"
                                                                            onClick={() => canHint && handleHintClick(idx, currentQuestion)}
                                                                            disabled={!canHint}
                                                                            title="İpucu Al"
                                                                            style={{ pointerEvents: canHint ? 'auto' : 'none' }}
                                                                        >
                                                                            <i className="bi bi-lightbulb-fill"></i>
                                                                            <span className="d-none d-sm-inline small">İpucu {currentHints}/{maxHints}</span>
                                                                        </Button>
                                                                    </span>
                                                                </OverlayTrigger>
                                                            )}
                                                            {wordObj ? (
                                                                <>
                                                                    <Button
                                                                        variant="outline-secondary"
                                                                        size="sm"
                                                                        className="rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                                                                        onClick={() => setDetailWord(wordObj)}
                                                                        title="Kelime Detayı"
                                                                    >
                                                                        <i className="bi bi-book"></i>
                                                                        <span className="d-none d-sm-inline small">Detayı Aç</span>
                                                                    </Button>
                                                                    {onDelete && (
                                                                        <Button
                                                                            variant="outline-danger"
                                                                            size="sm"
                                                                            className="rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                                                                            onClick={(e) => onDelete(e, wordObj.id, wordObj.term)}
                                                                            title="Kelimeyi Sil"
                                                                        >
                                                                            <i className="bi bi-trash"></i>
                                                                            <span className="d-none d-sm-inline small">Sil</span>
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })()}
                                                {completed && (
                                                    <Badge bg={answers[idx]?.selected?.isCorrect ? 'success' : 'danger'} className="rounded-pill px-2 py-1">
                                                        {answers[idx]?.selected?.isCorrect ? 'Doğru' : 'Yanlış'}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mb-5 pb-3">
                                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                                <h4 className="text-body fw-medium lh-base m-0">
                                                    {currentQuestion.prompt}
                                                </h4>
                                                {/* Show pronunciation + speech button next to the prompt — only when prompt is English (format=term) */}
                                                {currentQuestion.format === 'term' && currentQuestion.pronunciation && (
                                                    <div
                                                        className="d-flex align-items-center gap-1 text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-pill"
                                                        onClick={() => handleSpeak(currentQuestion.prompt)}
                                                        title="Sesli Okunuş"
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <i className="bi bi-volume-up-fill fs-5"></i>
                                                        <span className="small fw-semibold mx-1">/{currentQuestion.pronunciation}/</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            {currentQuestion.type === 'written' ? (
                                                <div>
                                                    <span className="text-body-secondary fw-semibold d-block mb-3">
                                                        Cevabı yazıp Enter'a bas ya da butona tıkla
                                                    </span>
                                                    {!answers[idx] ? (
                                                        <div className="d-flex gap-2">
                                                            <input
                                                                id={`written-input-${idx}`}
                                                                type="text"
                                                                className="form-control bg-transparent text-body border-secondary border-opacity-50 rounded-3"
                                                                placeholder="Cevabınızı yazın..."
                                                                value={writtenInputs[idx] || ''}
                                                                onChange={e => setWrittenInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();

                                                                        let nextUnansweredIdx = questions.findIndex((q, i) => i > idx && !answers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

                                                                        if (nextUnansweredIdx === -1) {
                                                                            nextUnansweredIdx = questions.findIndex((q, i) => !answers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));
                                                                        }

                                                                        if (nextUnansweredIdx !== -1) {
                                                                            scrollToQuestion(nextUnansweredIdx);

                                                                            if (questions[nextUnansweredIdx].type === 'written') {
                                                                                setTimeout(() => {
                                                                                    const nextInput = document.getElementById(`written-input-${nextUnansweredIdx}`);
                                                                                    if (nextInput) nextInput.focus();
                                                                                }, 100);
                                                                            }
                                                                        } else {
                                                                            // All answered! Scroll to submit.
                                                                            if (submitBtnRef.current) {
                                                                                submitBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                            }
                                                                        }
                                                                    }
                                                                }}
                                                                disabled={completed}
                                                                autoComplete="off"
                                                            />
                                                            <Button
                                                                variant="info"
                                                                className="rounded-3 px-3 fw-bold text-dark"
                                                                style={{ backgroundColor: '#4fd1c5', border: 'none', whiteSpace: 'nowrap' }}
                                                                onClick={() => handleWrittenSubmit(idx, currentQuestion.answer)}
                                                                disabled={!writtenInputs[idx]?.trim()}
                                                            >
                                                                <i className="bi bi-check-lg"></i> Kontrol
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className={`rounded-3 p-3 border d-flex align-items-start gap-3 ${answers[idx]?.selected?.isCorrect
                                                            ? 'border-success bg-success bg-opacity-10'
                                                            : 'border-danger bg-danger bg-opacity-10'
                                                            }`}>
                                                            <i className={`bi ${answers[idx]?.selected?.isCorrect
                                                                ? 'bi-check-circle-fill text-success'
                                                                : 'bi-x-circle-fill text-danger'
                                                                } fs-5 mt-1`}></i>
                                                            <div className="flex-grow-1">
                                                                <div className={`fw-bold ${answers[idx]?.selected?.isCorrect ? 'text-success' : 'text-danger'}`}>
                                                                    Cevabınız: "{answers[idx]?.selected?.text}"
                                                                </div>
                                                                {/* Always show the correct answer with pronunciation + speak button */}
                                                                <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
                                                                    <span className="text-body-secondary small">Doğru cevap:</span>
                                                                    <span className="fw-bold text-success fs-6">{currentQuestion.answer}</span>
                                                                    {currentQuestion.format === 'definition' && currentQuestion.pronunciation && (
                                                                        <>
                                                                            <span className="small font-monospace text-muted">/{currentQuestion.pronunciation}/</span>
                                                                            <Button
                                                                                variant="link"
                                                                                className="p-0 text-primary opacity-75 text-decoration-none"
                                                                                onClick={() => handleSpeak(currentQuestion.answer)}
                                                                                title="Sesli Dinle"
                                                                                onMouseEnter={e => e.currentTarget.classList.replace('opacity-75', 'opacity-100')}
                                                                                onMouseLeave={e => e.currentTarget.classList.replace('opacity-100', 'opacity-75')}
                                                                            >
                                                                                <i className="bi bi-volume-up-fill fs-5"></i>
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : currentQuestion.type === 'flashcard' ? (
                                                <div>
                                                    {/* Front of card: prompt */}
                                                    <div
                                                        className={`rounded-4 border p-4 mb-3 text-center transition-all ${flippedCards[idx] ? 'border-info bg-info bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-secondary'}`}
                                                        onClick={() => !completed && flipCard(idx)}
                                                        style={{ cursor: completed ? 'default' : 'pointer', minHeight: '90px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                    >
                                                        {!flippedCards[idx] ? (
                                                            <span className="text-body-secondary fw-medium"><i className="bi bi-eye me-2"></i>Görmek için tıkla</span>
                                                        ) : (
                                                            <>
                                                                <span className="text-body-secondary small mb-1">Cevap:</span>
                                                                <h4 className="text-info fw-bold m-0">{currentQuestion.answer}</h4>
                                                                {currentQuestion.format === 'definition' && currentQuestion.pronunciation && (
                                                                    <div
                                                                        className="d-flex align-items-center gap-1 text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-pill mt-2"
                                                                        onClick={(e) => { e.stopPropagation(); handleSpeak(currentQuestion.answer); }}
                                                                        style={{ cursor: 'pointer' }}
                                                                        title="Sesli Okunüş"
                                                                    >
                                                                        <i className="bi bi-volume-up-fill"></i>
                                                                        <span className="small fw-semibold mx-1">/{currentQuestion.pronunciation}/</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Self-grading buttons — only after revealing */}
                                                    {!completed && (
                                                        <div className="d-flex gap-3 justify-content-center">
                                                            <Button
                                                                variant={answers[idx]?.selected?.isCorrect === false ? 'danger' : 'outline-danger'}
                                                                className="rounded-pill px-4 fw-semibold"
                                                                onClick={() => handleSelectAnswer(idx, { text: 'Bilmedim', isCorrect: false })}
                                                            >
                                                                <i className="bi bi-x-circle me-2"></i>Bilmedim
                                                            </Button>
                                                            <Button
                                                                variant={answers[idx]?.selected?.isCorrect === true ? 'success' : 'outline-success'}
                                                                className="rounded-pill px-4 fw-semibold"
                                                                onClick={() => handleSelectAnswer(idx, { text: 'Bildim', isCorrect: true })}
                                                            >
                                                                <i className="bi bi-check-circle me-2"></i>Bildim
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {/* After test completed, show result inline */}
                                                    {completed && (
                                                        <div className="text-center">
                                                            <span className={`fw-bold fs-5 ${answers[idx]?.selected?.isCorrect ? 'text-success' : 'text-danger'}`}>
                                                                {answers[idx]?.selected?.isCorrect ? <><i className="bi bi-check-circle-fill me-2"></i>Bildin!</> : <><i className="bi bi-x-circle-fill me-2"></i>Bilmedin</>}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : currentQuestion.type === 'tf' ? (
                                                <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25 ">
                                                    <span className="text-body-secondary fw-semibold d-block mb-2">
                                                        Eşleşen {currentQuestion.format === 'definition' ? 'kelime' : 'anlam'} bu mu?
                                                    </span>
                                                    <div className="d-flex  gap-3 flex-wrap">
                                                        <h3 className="text-info fw-bold m-0">{currentQuestion.displayedAnswerText}</h3>
                                                        {/* Pronunciation next to the displayed word (for format=definition, displayed word is a term) */}
                                                        {currentQuestion.format === 'definition' && currentQuestion.pronunciation && (
                                                            <div
                                                                className="d-flex align-items-center gap-1 text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-pill"
                                                                onClick={() => handleSpeak(currentQuestion.displayedAnswerText)}
                                                                title="Sesli Okunuş"
                                                                style={{ cursor: 'pointer' }}
                                                            >
                                                                <i className="bi bi-volume-up-fill fs-5"></i>
                                                                <span className="small fw-semibold mx-1">/{currentQuestion.pronunciation}/</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-body-secondary fw-semibold d-block mb-3">
                                                    Eşleşen {currentQuestion.format === 'definition' ? 'kelimeyi' : 'anlamı'} seçiniz
                                                </span>
                                            )}
                                            <Row className="g-3 align-items-stretch">
                                                {(currentQuestion.options || []).map((opt, i) => {
                                                    const isSelected = answers[idx]?.selected?.text === opt.text;
                                                    const isAnswered = !!answers[idx];
                                                    const isHidden = (hiddenOptions[idx] || []).includes(i);

                                                    if (isHidden && !completed && !isSelected) {
                                                        return (
                                                            <Col md={6} key={i} className="d-flex" style={{ visibility: 'hidden' }}>
                                                                <div className="border rounded-3 p-3 w-100"></div>
                                                            </Col>
                                                        );
                                                    }

                                                    let btnStateClass = "border-secondary border-opacity-50 text-body-secondary";
                                                    let numberBadgeClass = "bg-secondary bg-opacity-25 text-body";

                                                    if (completed) {
                                                        // TEST BITTI: Doğru/Yanlış gösterimi
                                                        if (opt.isCorrect) {
                                                            btnStateClass = "border-success text-success bg-success bg-opacity-10 shadow-sm";
                                                            numberBadgeClass = "bg-success text-white";
                                                        } else if (isSelected && !opt.isCorrect) {
                                                            btnStateClass = "border-danger text-danger bg-danger bg-opacity-10";
                                                            numberBadgeClass = "bg-danger text-white";
                                                        } else {
                                                            btnStateClass += " opacity-50"; // diğer şıkları soluklaştır
                                                        }
                                                    } else {
                                                        // TEST DEVAM EDIYOR: Sadece seçimi göster
                                                        if (isSelected) {
                                                            btnStateClass = "border-info text-info bg-info bg-opacity-10 shadow-sm";
                                                            numberBadgeClass = "bg-info text-dark";
                                                        } else if (!isAnswered) {
                                                            btnStateClass += " hover-bg-secondary";
                                                        }
                                                    }

                                                    return (
                                                        <Col md={6} key={i} className="d-flex">
                                                            <div
                                                                className={`border rounded-3 p-3 d-flex align-items-center gap-3 transition-all w-100 ${btnStateClass}`}
                                                                onClick={() => handleSelectAnswer(idx, opt)}
                                                                style={{ cursor: completed ? 'default' : 'pointer' }}
                                                            >
                                                                <div className={`rounded-circle d-flex align-items-center justify-content-center fw-bold transition-all flex-shrink-0 ${numberBadgeClass}`} style={{ width: '28px', height: '28px', minWidth: '28px', fontSize: '13px' }}>
                                                                    {i + 1}
                                                                </div>
                                                                <span className={
                                                                    completed && opt.isCorrect ? 'text-success fw-bold' :
                                                                        (completed && isSelected && !opt.isCorrect ? 'text-danger text-decoration-line-through' :
                                                                            (isSelected ? 'text-info fw-bold' : 'text-body fw-medium'))
                                                                }>
                                                                    {opt.text}
                                                                </span>

                                                                {/* For definition-format questions: options are terms (english words) — show each option's pronunciation */}
                                                                {currentQuestion.format === 'definition' && opt.pronunciation && (
                                                                    <span className="ms-1 small font-monospace text-muted">/{opt.pronunciation}/</span>
                                                                )}

                                                                {currentQuestion.format === 'definition' && currentQuestion.type !== 'tf' && (
                                                                    <Button
                                                                        variant="link"
                                                                        className="p-0 ms-auto text-primary opacity-50 text-decoration-none"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleSpeak(opt.text);
                                                                        }}
                                                                        title="Sesli Dinle"
                                                                        onMouseEnter={e => e.currentTarget.classList.replace('opacity-50', 'opacity-100')}
                                                                        onMouseLeave={e => e.currentTarget.classList.replace('opacity-100', 'opacity-50')}
                                                                    >
                                                                        <i className="bi bi-volume-up-fill fs-5"></i>
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </Col>
                                                    )
                                                })}
                                            </Row>
                                        </div>
                                    </Card>
                                </div>
                            ))}
                        </div>

                        {/* Submit Button */}
                        {!completed && (
                            <div className="mt-5 text-center" ref={submitBtnRef}>
                                <Button
                                    variant={allAnswered ? "primary" : "outline-primary"}
                                    size="lg"
                                    className="rounded-pill px-5 py-3 fw-bold shadow-lg w-100"
                                    style={{ maxWidth: '400px' }}
                                    onClick={handleSubmit}
                                >
                                    <i className="bi bi-check-circle-fill me-2"></i> Kontrol Et {allAnswered ? '' : `(${getAnsweredCount()}/${questions.length})`}
                                </Button>
                            </div>
                        )}
                    </Col>
                </Row>
            </Container>

            {/* WORD DETAIL MODAL — shared component, identical to App.jsx */}
            <WordDetailModal
                word={detailWord}
                onHide={() => setDetailWord(null)}
                onSpeak={handleSpeak}
            />
        </>);
}

const StatusBadge = ({ isCorrect }) => {
    let icon = isCorrect ? "bi-check-circle-fill" : "bi-x-circle-fill";
    let colorClass = isCorrect ? "text-success" : "text-danger";
    let bgClass = isCorrect ? "bg-success" : "bg-danger";

    return (
        <div className={`${bgClass} bg-opacity-25 rounded-pill px-3 py-1 d-flex align-items-center gap-2 fw-bold fs-6 border border-${isCorrect ? 'success' : 'danger'} border-opacity-50`}>
            <i className={`bi ${icon} ${colorClass}`}></i> <span className={colorClass}>{status}</span>
        </div>
    );
};

export default PracticeTestActive;
