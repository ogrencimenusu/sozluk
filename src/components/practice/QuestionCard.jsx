import React, { memo } from 'react';
import { Button, Row, Col, Card, Badge, OverlayTrigger, Popover, Dropdown } from 'react-bootstrap';
import LearningStageBar from '../LearningStageBar';

const QuestionCard = memo(({ 
    idx, 
    currentQuestion, 
    wordObj, 
    answer, 
    writtenInput, 
    completed, 
    hintsUsedCount, 
    revealedHintIndices, 
    hiddenOptionIndices, 
    isActive,
    initialTestState,
    customLists,
    flipped,
    onFlip,
    activeMeanings,
    onNextMeaning,
    onToggleStar,
    onDelete,
    onAddWordsToList,
    onRemoveWordFromList,
    handleSpeak,
    handleSelectAnswer,
    handleWrittenSubmit,
    handleHintClick,
    focusNextWrittenQuestion,
    scrollToQuestion,
    displayMeaning,
    hasMultipleMeanings,
    canRevealMoreMeanings,
    setSelectedWordForModal,
    setWrittenInputs,
    questions
}) => {
    const isMcq = currentQuestion.type !== 'tf' && currentQuestion.type !== 'written' && currentQuestion.type !== 'flashcard' && currentQuestion.options;
    const isWritten = currentQuestion.type === 'written';
    const maxHints = isMcq ? Math.max(0, (currentQuestion.options?.filter(o => !o.isCorrect).length || 0) - 1) : (isWritten ? (currentQuestion.answer || '').trim().length : (currentQuestion.type === 'tf' ? 0 : 3));
    const currentHints = hintsUsedCount || 0;
    const canHint = !completed && !answer && currentHints < maxHints;

    const popover = (
        <Popover id={`popover-hint-${idx}`}>
            <Popover.Header as="h3">İpucu <i className="bi bi-lightbulb text-warning"></i></Popover.Header>
            <Popover.Body>
                {currentHints === 0 ? (
                    canHint ? "İpucu almak için butona tıklayın." : "İpucu kalmadı."
                ) : isMcq ? (
                    `${currentHints} yanlış şık elendi!`
                ) : isWritten ? (
                    (() => {
                        const ans = (currentQuestion.answer || '').trim();
                        const revealed = revealedHintIndices || [];
                        let displayArr = [];
                        for (let i = 0; i < ans.length; i++) {
                            if (ans[i] === ' ') {
                                displayArr.push('\u00A0\u00A0');
                            } else if (revealed.includes(i)) {
                                displayArr.push(ans[i]);
                            } else {
                                displayArr.push('_');
                            }
                        }
                        return (
                            <div className="text-center">
                                <div className="fw-bold font-monospace px-2 py-1 bg-body-tertiary rounded text-body text-nowrap" style={{ fontSize: '1.1rem' }}>
                                    {displayArr.join(' ')}
                                </div>
                            </div>
                        );
                    })()
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
        <div 
            style={
                !completed && isActive
                    ? { borderRadius: '1rem', border: '2px solid #6f42c1', boxShadow: '0 0 0 5px rgba(111,66,193,0.2)', transition: 'border-color 0.2s ease, box-shadow 0.2s ease' }
                    : completed && !answer?.selected?.isCorrect
                        ? { borderRadius: '1rem', border: '2px solid #dc3545' }
                        : { borderRadius: '1rem', border: '2px solid transparent', transition: 'border-color 0.2s ease, box-shadow 0.2s ease' }
            }
        >
            <Card className="position-relative bg-body-tertiary border-0 rounded-4 p-4 shadow-none">
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
                            const stage = wordObj?.learningStage ?? 0;
                            return (
                                <div className="d-none d-md-flex align-items-center gap-2" style={{ minWidth: '110px' }}>
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
                            return (
                                <div className="d-flex gap-2 align-items-center position-relative">
                                    {initialTestState?.config?.advancedOptions?.progressiveHint && currentHints > 0 && (
                                        <Badge bg="danger" className="position-absolute end-100 me-2 top-50 translate-middle-y" style={{ animation: 'shake 0.4s' }} title="Puan Değeri Düştü">
                                            -%{Math.min(100, currentHints * 30)} Puan
                                        </Badge>
                                    )}
                                    {maxHints > 0 && (() => {
                                        const hintButtonNode = (
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
                                                    <span className="d-none d-sm-inline small">{currentHints}/{maxHints}</span>
                                                </Button>
                                            </span>
                                        );

                                        if (initialTestState?.config?.advancedOptions?.missingLetters && isWritten) {
                                            return hintButtonNode;
                                        }

                                        return (
                                            <OverlayTrigger trigger={['hover', 'focus']} placement="top" overlay={popover}>
                                                {hintButtonNode}
                                            </OverlayTrigger>
                                        );
                                    })()}
                                    {hasMultipleMeanings(idx) && (
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            className="rounded-pill px-3 py-1 d-none d-md-flex align-items-center gap-1 border-opacity-75"
                                            onClick={() => onNextMeaning(idx)}
                                            title={canRevealMoreMeanings(idx) ? "Diğer Anlamı Göster" : "Tüm Anlamlar Gösterildi"}
                                            disabled={completed || !!answer || !canRevealMoreMeanings(idx)}
                                        >
                                            <i className="bi bi-plus-circle"></i>
                                            <span className="small">Diğer Anlam</span>
                                        </Button>
                                    )}
                                    {wordObj ? (
                                        <>
                                            {(() => {
                                                const listsWithWord = customLists?.filter(l => l.wordIds?.includes(wordObj.id)) || [];
                                                const listCount = listsWithWord.length;
                                                return (
                                                    <Dropdown align="end" className="d-inline-flex">
                                                        <Dropdown.Toggle
                                                            variant={listCount > 0 ? "primary" : "outline-primary"}
                                                            size="sm"
                                                            className="rounded-circle px-2 py-1 d-flex align-items-center no-caret border-opacity-75 position-relative shadow-sm"
                                                            title="Listeye Ekle/Çıkar"
                                                        >
                                                            <i className="bi bi-collection-play-fill text-white"></i>
                                                            {listCount > 0 && (
                                                                <Badge 
                                                                    bg="danger" 
                                                                    pill 
                                                                    className="position-absolute top-0 start-100 translate-middle border border-2 border-white"
                                                                    style={{ fontSize: '10px', padding: '0.25em 0.5em', minWidth: '18px' }}
                                                                >
                                                                    {listCount}
                                                                </Badge>
                                                            )}
                                                        </Dropdown.Toggle>

                                                        <Dropdown.Menu className="shadow-lg border-secondary border-opacity-25 bg-body-tertiary rounded-3" style={{ minWidth: '220px' }}>
                                                            <Dropdown.Header className="small fw-bold text-primary border-bottom border-opacity-10 mb-1 d-flex justify-content-between align-items-center">
                                                                <span>Listelere Ekle</span>
                                                                {listCount > 0 && <span className="badge bg-primary bg-opacity-10 text-primary fw-normal px-2">{listCount} Liste</span>}
                                                            </Dropdown.Header>
                                                            {customLists && customLists.length > 0 ? (
                                                                customLists.slice().sort((a,b) => {
                                                                    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                                                                    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                                                                    if (orderA !== orderB) return orderA - orderB;
                                                                    return new Date(b.createdAt) - new Date(a.createdAt);
                                                                }).map(list => {
                                                                    const isInList = list.wordIds?.includes(wordObj.id);
                                                                    return (
                                                                        <Dropdown.Item 
                                                                            key={list.id} 
                                                                            className={`small d-flex align-items-center justify-content-between gap-2 py-2 ${isInList ? 'bg-primary bg-opacity-10' : ''}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isInList) {
                                                                                    onRemoveWordFromList && onRemoveWordFromList(list.id, wordObj.id);
                                                                                } else {
                                                                                    onAddWordsToList && onAddWordsToList(list.id, [wordObj.id]);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <div className="d-flex align-items-center gap-2">
                                                                                <i className={`bi ${isInList ? 'bi-collection-play-fill text-primary' : 'bi-collection-play opacity-50'}`}></i> 
                                                                                <span className={isInList ? 'fw-bold text-primary' : ''}>{list.name}</span>
                                                                            </div>
                                                                            {isInList && <i className="bi bi-check2 text-primary fw-bold"></i>}
                                                                        </Dropdown.Item>
                                                                    );
                                                                })
                                                            ) : (
                                                                <Dropdown.Item disabled className="small text-muted py-2 text-center italic">Henüz liste yok</Dropdown.Item>
                                                            )}
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                );
                                            })()}

                                            {/* More Actions Dropdown for Mobile Only */}
                                            <Dropdown align="end" className="d-inline-flex d-md-none">
                                                <Dropdown.Toggle
                                                    variant="outline-secondary"
                                                    size="sm"
                                                    className="rounded-circle px-2 py-1 d-flex align-items-center no-caret border-opacity-75 shadow-sm"
                                                    title="Daha Fazla Seçenek"
                                                >
                                                    <i className="bi bi-three-dots text-body-secondary"></i>
                                                </Dropdown.Toggle>

                                                <Dropdown.Menu className="shadow-lg border-secondary border-opacity-25 bg-body-tertiary rounded-3" style={{ minWidth: '200px' }}>
                                                    <div className="d-md-none p-2 border-bottom border-opacity-10 mb-2">
                                                        <div className="small fw-bold text-body-secondary mb-2 px-2">Öğrenme Durumu</div>
                                                        <div className="d-flex align-items-center justify-content-between px-2 gap-3">
                                                            {onToggleStar && (
                                                                <button
                                                                    className="btn btn-link p-0 border-0 text-decoration-none"
                                                                    onClick={(e) => { e.stopPropagation(); onToggleStar(e, wordObj); }}
                                                                >
                                                                    <i className={`fs-5 bi ${wordObj.isStarred ? 'bi-star-fill text-warning' : 'bi-star text-secondary'}`}></i>
                                                                </button>
                                                            )}
                                                            <div className="flex-grow-1">
                                                                <LearningStageBar stage={wordObj?.learningStage || 0} showLabel />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {hasMultipleMeanings(idx) && (
                                                        <Dropdown.Item 
                                                            className="small d-flex align-items-center gap-2 py-2"
                                                            onClick={() => onNextMeaning(idx)}
                                                            disabled={completed || !!answer || !canRevealMoreMeanings(idx)}
                                                        >
                                                            <i className="bi bi-plus-circle text-primary"></i> Diğer Anlamı Göster
                                                        </Dropdown.Item>
                                                    )}

                                                    <Dropdown.Item 
                                                        className="small d-flex align-items-center gap-2 py-2"
                                                        onClick={() => setSelectedWordForModal(wordObj)}
                                                    >
                                                        <i className="bi bi-info-circle text-secondary"></i> Kelime Detayı
                                                    </Dropdown.Item>

                                                    {onDelete && (
                                                        <>
                                                            <Dropdown.Divider className="opacity-10" />
                                                            <Dropdown.Item 
                                                                className="small d-flex align-items-center gap-2 py-2 text-danger"
                                                                onClick={(e) => onDelete(e, wordObj.id, wordObj.term)}
                                                            >
                                                                <i className="bi bi-trash text-danger"></i> Kelimeyi Sil
                                                            </Dropdown.Item>
                                                        </>
                                                    )}
                                                </Dropdown.Menu>
                                            </Dropdown>

                                            <Button
                                                variant="outline-secondary"
                                                size="sm"
                                                className="rounded-pill px-3 py-1 d-none d-md-flex align-items-center gap-1"
                                                onClick={() => setSelectedWordForModal(wordObj)}
                                                title="Kelime Detayı"
                                            >
                                                <i className="bi bi-info-circle"></i>
                                                <span className="small">Detay</span>
                                            </Button>

                                            {onDelete && (
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    className="rounded-circle px-2 py-1 d-none d-md-flex align-items-center gap-1"
                                                    onClick={(e) => onDelete(e, wordObj.id, wordObj.term)}
                                                    title="Kelimeyi Sil"
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </Button>
                                            )}
                                        </>
                                    ) : null}
                                </div>
                            );
                        })()}
                        {completed && (
                            <Badge bg={answer?.selected?.isCorrect ? 'success' : 'danger'} className="rounded-pill px-2 py-1">
                                {answer?.selected?.isCorrect ? 'Doğru' : 'Yanlış'}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="mb-3 pb-3">
                    {currentQuestion.format === 'example' && currentQuestion.questionContext && (
                        <div className="mb-2">
                            <Badge bg="info" className="bg-opacity-25 text-info-emphasis px-2 py-1 rounded-pill">
                                <i className="bi bi-info-circle me-1"></i> {currentQuestion.questionContext}
                            </Badge>
                        </div>
                    )}
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                        <h6 className="text-body fw-medium lh-base m-0">
                            {currentQuestion.format === 'definition' ? displayMeaning(currentQuestion.prompt, idx) : currentQuestion.prompt}
                        </h6>
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
                        <div className="mb-3">

                            {initialTestState?.config?.advancedOptions?.missingLetters && !answer && (
                                <div className="mb-3 text-center p-3 rounded-3 border border-info border-opacity-50 bg-info bg-opacity-10">
                                    <div className="small text-info fw-bold mb-2">
                                        <i className="bi bi-alphabet me-1"></i> Eksik Harfler İpucu
                                    </div>
                                    <div className="fs-3 font-monospace fw-bold text-body letter-spacing-2" style={{ letterSpacing: '4px' }}>
                                        {currentQuestion.answer.split('').map((char, i) => {
                                            if (char === ' ') return <span key={i} className="mx-3"></span>;
                                            const revealed = revealedHintIndices || [];
                                            const show = revealed.includes(i);
                                            return <span key={i} className={show ? "text-primary" : "text-body-tertiary"}>{show ? char : '_'}</span>;
                                        })}
                                    </div>
                                </div>
                            )}

                            {!answer ? (
                                <div className="d-flex flex-column gap-1">
                                    <div className="d-flex gap-2">
                                        <input
                                            id={`written-input-${idx}`}
                                            type="text"
                                            className="form-control bg-transparent text-body border-secondary border-opacity-50 rounded-3"
                                            style={{ fontSize: '1.1rem' }}
                                            placeholder="Cevabınızı yazın..."
                                            value={writtenInput || ''}
                                            autoCapitalize="none"
                                            onChange={e => setWrittenInputs(prev => ({ ...prev, [idx]: e.target.value.toLowerCase() }))}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();

                                                    let nextUnansweredIdx = questions.findIndex((q, i) => i > idx && !questions[i].isAnswered && !(q.type === 'written' && (questions[i].writtenInput || '').trim().length > 0));
                                                    
                                                    // In PracticeTestActive, we use the state. This logic needs to be careful.
                                                    // For now, let's keep the core Enter logic but it might need refinement if it loses access to 'answers' state
                                                    // Actually, we can pass a callback 'onEnter'
                                                    if (currentQuestion.onEnter) {
                                                        currentQuestion.onEnter(idx);
                                                    }
                                                }
                                            }}
                                            disabled={completed}
                                            autoComplete="off"
                                        />
                                        <Button
                                            variant="info"
                                            className="rounded-3 px-3 fw-bold text-dark d-flex align-items-center justify-content-center"
                                            style={{ backgroundColor: '#4fd1c5', border: 'none', whiteSpace: 'nowrap', width: '46px', height: '46px' }}
                                            onClick={() => handleWrittenSubmit(idx, currentQuestion.answer)}
                                            disabled={!writtenInput?.trim()}
                                        >
                                            <i className="bi bi-check-lg fs-4"></i>
                                        </Button>
                                    </div>
                                    <small className={`ms-1 ${(writtenInput || '').length === (currentQuestion.answer || '').length ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.75rem', fontWeight: (writtenInput || '').length === (currentQuestion.answer || '').length ? 'bold' : 'normal' }}>
                                        {(writtenInput || '').length} harf
                                    </small>
                                </div>
                            ) : (
                                <div className={`rounded-3 p-3 border d-flex align-items-start gap-3 ${answer?.selected?.isCorrect
                                    ? answer?.selected?.hasTypo ? 'border-warning bg-warning bg-opacity-10' : 'border-success bg-success bg-opacity-10'
                                    : 'border-danger bg-danger bg-opacity-10'
                                    }`}>
                                    <i className={`bi ${answer?.selected?.isCorrect
                                        ? answer?.selected?.hasTypo ? 'bi-exclamation-circle-fill text-warning' : 'bi-check-circle-fill text-success'
                                        : 'bi-x-circle-fill text-danger'
                                        } fs-6 `}></i>
                                    <div className="flex-grow-1">
                                        <div className={`fw-bold justify-content-between d-flex ${answer?.selected?.isCorrect ? (answer?.selected?.hasTypo ? 'text-warning' : 'text-success') : 'text-danger'}`}>
                                            Cevabınız: "{answer?.selected?.text}"
                                            {answer?.selected?.hasTypo && (
                                                <div className="text-warning small mt-1 fw-medium">
                                                    <i className="bi bi-info-circle me-1"></i> Ufak harf hatalarıyla doğru kabul edildi.
                                                </div>
                                            )}
                                        </div>

                                        {/* Always show the correct answer with pronunciation + speak button */}
                                        <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
                                            <span className="text-body-secondary small">Doğru cevap:</span>
                                            <span className={`fw-bold fs-6 ${answer?.selected?.isCorrect && !answer?.selected?.hasTypo ? 'text-success' : 'text-body'}`}>{currentQuestion.format === 'term' ? displayMeaning(currentQuestion.answer, idx) : currentQuestion.answer}</span>
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
                                className={`rounded-4 border p-4 mb-3 text-center transition-all ${flipped ? 'border-info bg-info bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-secondary'}`}
                                onClick={() => !completed && onFlip(idx)}
                                style={{ cursor: completed ? 'default' : 'pointer', minHeight: '90px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {!flipped ? (
                                    <span className="text-body-secondary fw-medium"><i className="bi bi-eye me-2"></i>Görmek için tıkla</span>
                                ) : (
                                    <>
                                        <span className="text-body-secondary small mb-1">Cevap:</span>
                                        <h4 className="text-info fw-bold m-0">{currentQuestion.format === 'term' ? displayMeaning(currentQuestion.answer, idx) : currentQuestion.answer}</h4>
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
                                        variant={answer?.selected?.isCorrect === true ? 'success' : 'outline-success'}
                                        className="rounded-pill px-4 fw-semibold d-flex align-items-center gap-2"
                                        onClick={() => handleSelectAnswer(idx, { text: 'Bildim', isCorrect: true })}
                                    >
                                        <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '20px', height: '20px', fontSize: '11px', padding: 0 }}>1</span>
                                        <i className="bi bi-check-circle"></i>Bildim
                                    </Button>
                                    <Button
                                        variant={answer?.selected?.isCorrect === false ? 'danger' : 'outline-danger'}
                                        className="rounded-pill px-4 fw-semibold d-flex align-items-center gap-2"
                                        onClick={() => handleSelectAnswer(idx, { text: 'Bilmedim', isCorrect: false })}
                                    >
                                        <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50 rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '20px', height: '20px', fontSize: '11px', padding: 0 }}>2</span>
                                        <i className="bi bi-x-circle"></i>Bilmedim
                                    </Button>
                                </div>
                            )}

                            {/* After test completed, show result inline */}
                            {completed && (
                                <div className="text-center">
                                    <span className={`fw-bold fs-5 ${answer?.selected?.isCorrect ? 'text-success' : 'text-danger'}`}>
                                        {answer?.selected?.isCorrect ? <><i className="bi bi-check-circle-fill me-2"></i>Bildin!</> : <><i className="bi bi-x-circle-fill me-2"></i>Bilmedin</>}
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
                                <h3 className="text-info fw-bold m-0">{currentQuestion.format === 'term' ? displayMeaning(currentQuestion.displayedAnswerText, idx) : currentQuestion.displayedAnswerText}</h3>
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
                            const isSelected = answer?.selected?.text === opt.text;
                            const isAnswered = !!answer;
                            const isHidden = (hiddenOptionIndices || []).includes(i);

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
                                            {currentQuestion.format === 'term' ? displayMeaning(opt.text, idx) : opt.text}
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

                {/* Placed at the very bottom center of the card */}
                {!completed && currentQuestion.type === 'written' && !answer && (() => {
                    const hasPrevious = questions.some((q, i) => i < idx && q.type === 'written' && !questions[i].isAnswered); // This logic needs help
                    const hasNext = questions.some((q, i) => i > idx && q.type === 'written' && !questions[i].isAnswered);

                    return (
                        <div className="mt-4" style={{ zIndex: 10 }}>
                            <div className="btn-group border border-secondary border-opacity-50  overflow-hidden bg-body shadow-sm" role="group">
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 px-3 text-body-secondary hover-text-primary transition-all border-0 shadow-none d-flex align-items-center justify-content-center border-end border-secondary border-opacity-25 rounded-0"
                                    onClick={() => focusNextWrittenQuestion(idx, 'up')}
                                    disabled={false} // Simplify for now
                                    title="Önceki Yazılı Soru"
                                    style={{ height: '32px' }}
                                >
                                    <i className="bi bi-chevron-up" style={{ fontSize: '1rem' }}></i>
                                </Button>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 px-3 text-body-secondary hover-text-danger transition-all border-0 shadow-none d-flex align-items-center justify-content-center border-end border-secondary border-opacity-25 rounded-0"
                                    onClick={() => {
                                        setWrittenInputs(prev => ({ ...prev, [idx]: '' }));
                                        const input = document.getElementById(`written-input-${idx}`);
                                        if (input) input.focus();
                                    }}
                                    disabled={!writtenInput}
                                    title="Cevabı Temizle"
                                    style={{ height: '32px' }}
                                >
                                    <i className="bi bi-x-lg" style={{ fontSize: '0.9rem' }}></i>
                                </Button>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 px-3 text-body-secondary hover-text-primary transition-all border-0 shadow-none d-flex align-items-center justify-content-center rounded-0"
                                    onClick={() => focusNextWrittenQuestion(idx, 'down')}
                                    disabled={false} // Simplify
                                    title="Sonraki Yazılı Soru"
                                    style={{ height: '32px' }}
                                >
                                    <i className="bi bi-chevron-down" style={{ fontSize: '1rem' }}></i>
                                </Button>
                            </div>
                        </div>
                    );
                })()}
            </Card>
        </div>
    );
});

export default QuestionCard;
