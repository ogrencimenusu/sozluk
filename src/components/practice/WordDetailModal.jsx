import React, { useState } from 'react';
import { Modal, Button, Row, Col, Badge } from 'react-bootstrap';

/**
 * Shared word detail modal — identical content to the App.jsx selectedWord modal.
 * Props:
 *   word        – the word object to display (or null to hide)
 *   onHide      – callback to close the modal
 *   onSpeak     – (text) => void   speech-synthesis helper
 *   onEdit      – (word) => void   callback to edit the word
 */
function WordDetailModal({ word, onHide, onSpeak, onEdit }) {
    if (!word) return null;

    return (
        <>
            <Modal
                show={!!word}
                onHide={onHide}
                size="xl"
                centered
                scrollable
                contentClassName="bg-body-tertiary border border-opacity-25 rounded-4 shadow-lg"
            >
                <Modal.Header className="border-bottom border-opacity-10 align-items-center py-3 px-4 px-md-5 bg-body-tertiary">
                    <Modal.Title className="display-6 fw-bold m-0 me-3">{word.term}</Modal.Title>
                    <div className="ms-auto d-flex align-items-center gap-2">
                        <Button
                            variant="outline-primary"
                            size="sm"
                            className="rounded-pill px-3 shadow-sm bg-body d-flex align-items-center gap-2"
                            onClick={() => {
                                onEdit && onEdit(word);
                            }}
                        >
                            <i className="bi bi-pencil-square"></i>
                            <span className="d-none d-sm-inline">Düzenle</span>
                        </Button>
                        <Button
                            variant="link"
                            className="p-1 ms-2 text-body-secondary text-decoration-none hover-text-danger transition-all"
                            onClick={onHide}
                            title="Kapat"
                        >
                            <i className="bi bi-x-lg fs-5"></i>
                        </Button>
                    </div>
                </Modal.Header>

                <Modal.Body className="p-4 p-md-5 custom-scroll">
                    <div className="mb-4">
                        {word.pronunciation && (
                            <div
                                className="text-muted font-monospace d-inline-flex align-items-center bg-body-secondary px-3 py-2 rounded-3 fs-5 w-auto interactive-pronunciation mb-2"
                                style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
                                title="Sesli Dinle"
                                onClick={() => onSpeak && onSpeak(word.term)}
                                onMouseEnter={e => e.currentTarget.classList.add('shadow-sm')}
                                onMouseLeave={e => e.currentTarget.classList.remove('shadow-sm')}
                            >
                                <i className="bi bi-volume-up-fill me-2 text-primary" style={{ fontSize: '24px' }}></i> /{word.pronunciation.replace(/^\/|\/$/g, '')}/
                            </div>
                        )}
                        {word.cefrLevel && (
                            <div className="ps-2 border-start border-3 border-info border-opacity-50 mt-1">
                                <span className="fw-bold text-info-emphasis me-1" style={{ fontSize: '0.9rem' }}>
                                    {word.cefrLevel.split(/[(\/\s]/)[0]}
                                </span>
                                <span className="text-muted small italic">
                                    {word.cefrLevel.includes(' ') || word.cefrLevel.includes('(') ? word.cefrLevel.substring(word.cefrLevel.split(/[(\/\s]/)[0].length) : ''}
                                </span>
                            </div>
                        )}
                    </div>

                    {word.shortMeanings && (
                        <div className="mb-4 border-start border-success border-4 ps-4 py-2 position-relative bg-body-secondary bg-opacity-50 rounded-end-4">
                            <i className="bi bi-bookmark-star-fill text-success opacity-25 position-absolute end-0 top-0 m-3" style={{ fontSize: '2rem', transform: 'rotate(15deg)' }}></i>
                            <h6 className="text-uppercase text-success fw-bold small letter-spacing-2 mb-2 d-flex align-items-center gap-2">
                                <i className="bi bi-list-task"></i> Kısa Anlamları
                            </h6>
                            <p className="m-0 fs-6 text-body lh-base pe-5" style={{ fontWeight: '500' }}>{word.shortMeanings}</p>
                        </div>
                    )}

                    {word.generalDefinition && (
                        <div className="mb-4 border-start border-primary border-4 ps-4 py-2 position-relative bg-body-secondary bg-opacity-50 rounded-end-4">
                            <i className="bi bi-info-circle-fill text-primary opacity-25 position-absolute end-0 top-0 m-3" style={{ fontSize: '2rem', transform: 'rotate(15deg)' }}></i>
                            <h6 className="text-uppercase text-primary fw-bold small letter-spacing-2 mb-2 d-flex align-items-center gap-2">
                                <i className="bi bi-journal-text"></i> Genel Tanımı
                            </h6>
                            <p className="m-0 fs-6 text-body lh-base pe-5" style={{ fontWeight: '500' }}>{word.generalDefinition}</p>
                        </div>
                    )}

                    {word.meanings && word.meanings.length > 0 && (
                        <div className="mb-5">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-4">Anlamları ve Örnek Cümleler</h5>
                            <div className="d-flex flex-column gap-3">
                                {word.meanings.map((m, idx) => (
                                    <div key={idx} className="meaning-item bg-body shadow-sm p-3 rounded-4 border border-opacity-10">
                                        <div className="d-flex align-items-center flex-wrap gap-2 mb-2 fw-bold lh-base">
                                            <Badge bg="primary" className="fw-semibold px-2 py-1 me-1 small" style={{ fontSize: '0.75rem' }}>{m.context || `Anlamı ${idx + 1}`}</Badge>
                                            <span className="fs-6">{m.definition}</span>
                                        </div>
                                        {m.examples && m.examples.length > 0 && (
                                            <div className="ms-md-3 ms-2 d-flex flex-column gap-1 mt-2">
                                                {m.examples
                                                    .filter(ex =>
                                                        !ex.toLowerCase().includes('detaylı i̇nceleme') &&
                                                        !ex.toLowerCase().includes('detaylı inceleme') &&
                                                        ex.replace(/['"]/g, '').trim() !== 'Detaylı İnceleme'
                                                    )
                                                    .map((ex, exIdx) => {
                                                        const match = ex.match(/^(.*?)(\([^)]+\))?$/);
                                                        let engPart = match ? match[1].trim() : ex;
                                                        let trPart = match && match[2] ? match[2].trim() : null;
                                                        let label = null;
                                                        const colonIdx = engPart.indexOf(':');
                                                        if (colonIdx !== -1) {
                                                            label = engPart.substring(0, colonIdx + 1).trim();
                                                            engPart = engPart.substring(colonIdx + 1).trim();
                                                        }
                                                        return (
                                                            <div key={exIdx} className={`position-relative pe-3 ps-3 fs-6 ${engPart ? 'mb-2' : 'mb-1'}`}>
                                                                {engPart && <span className="position-absolute start-0 text-primary fw-bold" style={{ top: '0' }}>•</span>}
                                                                {label && <div className="fw-bold text-primary extra-small mb-0 opacity-75" style={{ fontSize: '0.7rem' }}>{label}</div>}
                                                                {engPart && <div className="fst-italic text-body mb-0 lh-sm" style={{ fontSize: '0.95rem' }}>"{engPart}"</div>}
                                                                {trPart && <div className={`text-muted fst-italic extra-small ps-2 border-start border-2 border-primary ms-1 ${engPart ? 'mt-0' : ''}`} style={{ fontSize: '0.85rem' }}>{trPart}</div>}
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Row className="g-4 mb-4">
                        {word.synonyms && (
                            <Col md={6}>
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Eş Anlamlılar</h5>
                                <ul className="custom-ul">
                                    {word.synonyms.split(',').map((syn, idx) => (
                                        <li key={idx} className="fs-6 text-body">{syn.trim()}</li>
                                    ))}
                                </ul>
                            </Col>
                        )}
                        {word.antonyms && (
                            <Col md={6}>
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Zıt Anlamlılar</h5>
                                <ul className="custom-ul">
                                    {word.antonyms.split(',').map((ant, idx) => (
                                        <li key={idx} className="fs-6 text-body">{ant.trim()}</li>
                                    ))}
                                </ul>
                            </Col>
                        )}
                    </Row>

                    {word.collocations && word.collocations.length > 0 && (
                        <div className="mb-4">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Kullanıldığı Edatlar (Collocations)</h5>
                            <ul className="custom-ul">
                                {word.collocations.map((item, i) => {
                                    const lines = item.split('\n');
                                    return (
                                        <li key={i} className="fs-6 mb-3">
                                            <div className="fw-medium text-body">{lines[0]}</div>
                                            {lines.slice(1).map((line, li) => (
                                                <div key={li} className="text-muted fst-italic small ps-2 border-start border-2 border-primary ms-1 mt-1">{line}</div>
                                            ))}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {word.idioms && word.idioms.length > 0 && (
                        <div className="mb-4">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Deyimler (Idioms)</h5>
                            <ul className="custom-ul">
                                {word.idioms.map((item, i) => {
                                    const lines = item.split('\n');
                                    return (
                                        <li key={i} className="fs-6 mb-3">
                                            <div className="fw-medium text-body">{lines[0]}</div>
                                            {lines.slice(1).map((line, li) => (
                                                <div key={li} className="text-muted fst-italic small ps-2 border-start border-2 border-primary ms-1 mt-1">{line}</div>
                                            ))}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {word.wordFamily && word.wordFamily.length > 0 && (
                        <div className="mb-4">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-2 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                <i className="bi bi-diagram-3-fill text-primary"></i> Kelime Ailesi (Word Family)
                            </h5>
                            <div className="d-flex flex-column gap-2 ps-1">
                                {word.wordFamily.map((item, i) => {
                                    const parts = item.split('–');
                                    return (
                                        <div key={i} className="d-flex align-items-baseline gap-2 border-bottom border-opacity-10 pb-2 last-child-border-0">
                                            <i className="bi bi-arrow-right-short text-primary"></i>
                                            <div className="flex-grow-1">
                                                <span className="fw-bold text-body">{parts[0]?.trim()}</span>
                                                {parts[1] && <span className="text-muted small ms-2 fst-italic">— {parts[1].trim()}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {word.grammar && word.grammar.length > 0 && (
                        <div className="mb-4 bg-body-tertiary p-3 rounded-4 border border-opacity-10 shadow-sm border-start border-primary border-4">
                            <h5 className="text-uppercase text-primary fw-bold small letter-spacing-2 mb-3 d-flex align-items-center gap-2">
                                <i className="bi bi-code-square"></i> Gramer Özellikleri
                            </h5>
                            <div className="d-flex flex-column gap-2 ps-1">
                                {word.grammar.map((item, i) => {
                                    const parts = item.split(':');
                                    return (
                                        <div key={i} className="d-flex align-items-baseline gap-2">
                                            <i className="bi bi-dot text-primary fs-4 lh-1"></i>
                                            <div className="fs-6">
                                                <span className="text-muted-emphasis fw-semibold me-2">{parts[0]?.trim()}:</span>
                                                <span className="text-body">{parts.slice(1).join(':').trim()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {word.tips && word.tips.length > 0 && (
                        <div className="mb-4 bg-danger bg-opacity-10 border-start border-danger border-4 p-3 rounded-end-4 overflow-hidden position-relative">
                            <i className="bi bi-patch-exclamation text-danger opacity-10 position-absolute end-0 bottom-0 m-n2" style={{ fontSize: '4rem' }}></i>
                            <h6 className="text-uppercase text-danger fw-bold small letter-spacing-2 mb-3 d-flex align-items-center gap-2">
                                <i className="bi bi-exclamation-triangle-fill"></i> Sık Yapılan Hatalar ve İpuçları
                            </h6>
                            <div className="d-flex flex-column gap-2">
                                {word.tips.map((item, i) => {
                                    const lower = item.toLowerCase();
                                    const isErrorReason = lower.startsWith('hata nedeni:');
                                    const isWrong = lower.startsWith('yanlış kullanım:');
                                    const isCorrect = lower.startsWith('doğru kullanım:');
                                    const isTranslation = lower.startsWith('(') && lower.endsWith(')');

                                    let content = item;
                                    let styleClass = "text-body-emphasis";
                                    let icon = null;
                                    let extraMargin = "";

                                    if (isErrorReason) {
                                        styleClass = "bg-warning bg-opacity-10 text-warning-emphasis p-2 rounded-3 mb-1 border-start border-warning border-3 d-flex align-items-start";
                                        icon = <i className="bi bi-lightbulb-fill text-warning me-2 mt-1"></i>;
                                        extraMargin = "mt-2";
                                    } else if (isWrong) {
                                        styleClass = "text-danger-emphasis fw-semibold ps-4 position-relative mb-0";
                                        icon = <i className="bi bi-x-lg text-danger position-absolute start-0 top-0 mt-1" style={{fontSize: '0.8rem'}}></i>;
                                    } else if (isCorrect) {
                                        styleClass = "text-success-emphasis fw-semibold ps-4 position-relative mb-0";
                                        icon = <i className="bi bi-check-lg text-success position-absolute start-0 top-0 mt-1"></i>;
                                    } else if (isTranslation) {
                                        styleClass = "text-muted small fst-italic ps-4 mb-2 opacity-75";
                                    }

                                    return (
                                        <div key={i} className={`fs-6 ${styleClass} ${extraMargin}`}>
                                            {icon}
                                            {content}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </>
    );
}

export default WordDetailModal;
