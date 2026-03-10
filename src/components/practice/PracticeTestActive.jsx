import React, { useState, useRef } from 'react';
import { Container, Button, Row, Col, Card, Badge } from 'react-bootstrap';
import WordDetailModal from './WordDetailModal';
import LearningStageBar from '../LearningStageBar';
import Swal from 'sweetalert2';

function PracticeTestActive({ questions, words, onClose, onHome, onFinish, onUpdateStage }) {
    const [answers, setAnswers] = useState({}); // { [questionIdx]: { selected: OptionObj } }
    const [writtenInputs, setWrittenInputs] = useState({}); // { [questionIdx]: string } for 'written' type
    const [completed, setCompleted] = useState(false);
    const [flippedCards, setFlippedCards] = useState({}); // { [questionIdx]: true/false }
    const [detailWord, setDetailWord] = useState(null); // word to show in detail modal

    // Refs for scrolling to questions
    const questionRefs = useRef([]);

    const flipCard = (idx) => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }));

    const handleSelectAnswer = (qIdx, optionObj) => {
        if (completed) return; // Prevent changing answers after completion

        setAnswers(prev => {
            const newAnswers = { ...prev, [qIdx]: { selected: optionObj } };

            // Auto-advance to next unanswered question
            const nextUnansweredIdx = questions.findIndex((_, idx) => idx > qIdx && !newAnswers[idx]);
            if (nextUnansweredIdx !== -1 && questionRefs.current[nextUnansweredIdx]) {
                setTimeout(() => {
                    questionRefs.current[nextUnansweredIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300); // slight delay to show selection
            }

            return newAnswers;
        });
    };

    const handleWrittenSubmit = (qIdx, correctAnswer) => {
        if (completed) return;
        const typed = (writtenInputs[qIdx] || '').trim().toLowerCase();
        const correct = correctAnswer.trim().toLowerCase();
        const isCorrect = typed === correct;
        setAnswers(prev => {
            const newAnswers = { ...prev, [qIdx]: { selected: { text: writtenInputs[qIdx] || '', isCorrect } } };
            // Auto-advance to next unanswered
            const nextUnansweredIdx = questions.findIndex((_, idx) => idx > qIdx && !newAnswers[idx]);
            if (nextUnansweredIdx !== -1 && questionRefs.current[nextUnansweredIdx]) {
                setTimeout(() => {
                    questionRefs.current[nextUnansweredIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
            return newAnswers;
        });
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

    const handleSubmit = async () => {
        if (Object.keys(answers).length < questions.length) {
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
        setCompleted(true);

        // Update learning stages for each answered question
        if (onUpdateStage) {
            const updatePromises = questions.map((q, idx) => {
                if (answers[idx] === undefined) return Promise.resolve();
                const isCorrect = answers[idx]?.selected?.isCorrect;
                return onUpdateStage(q.wordId, isCorrect);
            });
            await Promise.all(updatePromises);
        }

        // Scroll to top to see results summary
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const correctCount = completed ? questions.filter((q, idx) => answers[idx]?.selected?.isCorrect).length : 0;
    const allAnswered = Object.keys(answers).length === questions.length;

    return (
        <>
            <Container fluid className="py-4 h-100 bg-body">
                <div className="d-flex justify-content-between align-items-center mb-4 px-md-4 sticky-top bg-body py-2 z-index-10 border-bottom border-secondary border-opacity-25 pb-3">
                    <div className="d-flex align-items-center gap-3">

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
                                {questions.map((_, idx) => {
                                    const isAnswered = !!answers[idx];

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
                            <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-4 shadow-sm mb-5 text-center" style={{ borderTop: '4px solid #198754' }}>
                                <div className="mb-3">
                                    <i className="bi bi-trophy-fill text-warning" style={{ fontSize: '3rem' }}></i>
                                </div>
                                <h2 className="fw-bold text-body mb-2">Test Tamamlandı!</h2>
                                <h4 className="text-body-secondary mb-4">{questions.length} sorudan {correctCount} doğru yaptın.</h4>
                                <div className="d-flex gap-3 justify-content-center">
                                    <Button variant="outline-secondary" className="rounded-pill px-4" onClick={onFinish}>
                                        Yeniden Çöz
                                    </Button>
                                    <Button variant="info" className="rounded-pill px-4 fw-bold text-dark" style={{ backgroundColor: '#4fd1c5', border: 'none' }} onClick={onClose}>
                                        Sözlüğe Dön
                                    </Button>
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
                                                        <div style={{ minWidth: '110px' }}>
                                                            <LearningStageBar stage={stage} showLabel />
                                                        </div>
                                                    );
                                                })()}
                                                {(() => {
                                                    const wordObj = (words || []).find(w => w.id === currentQuestion.wordId);
                                                    return wordObj ? (
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
                                                    ) : null;
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
                                                                type="text"
                                                                className="form-control bg-transparent text-body border-secondary border-opacity-50 rounded-3"
                                                                placeholder="Cevabınızı yazın..."
                                                                value={writtenInputs[idx] || ''}
                                                                onChange={e => setWrittenInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                                                                onKeyDown={e => { if (e.key === 'Enter') handleWrittenSubmit(idx, currentQuestion.answer); }}
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
                                                                    Yazanız: "{answers[idx]?.selected?.text}"
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
                            <div className="mt-5 text-center">
                                <Button
                                    variant={allAnswered ? "primary" : "outline-primary"}
                                    size="lg"
                                    className="rounded-pill px-5 py-3 fw-bold shadow-lg w-100"
                                    style={{ maxWidth: '400px' }}
                                    onClick={handleSubmit}
                                >
                                    <i className="bi bi-check-circle-fill me-2"></i> Kontrol Et {allAnswered ? '' : `(${Object.keys(answers).length}/${questions.length})`}
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
