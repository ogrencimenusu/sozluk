import React, { useState } from 'react';
import { Modal, Button, Row, Col, Badge } from 'react-bootstrap';

/**
 * Shared word detail modal — identical content to the App.jsx selectedWord modal.
 * Props:
 *   word        – the word object to display (or null to hide)
 *   onHide      – callback to close the modal
 *   onSpeak     – (text) => void   speech-synthesis helper
 */
function WordDetailModal({ word, onHide, onSpeak }) {
    const [showRaw, setShowRaw] = useState(false);

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
                <Modal.Header closeButton className="border-bottom border-opacity-10 align-items-center py-3 px-4 px-md-5 bg-body-tertiary">
                    <Modal.Title className="display-6 fw-bold m-0 me-3">{word.term}</Modal.Title>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        className="ms-auto rounded-pill px-3 shadow-sm bg-body"
                        onClick={() => setShowRaw(true)}
                    >
                        Orijinal Metni Gör
                    </Button>
                </Modal.Header>

                <Modal.Body className="p-4 p-md-5 custom-scroll">
                    {word.pronunciation && (
                        <div
                            className="text-muted font-monospace d-inline-flex align-items-center bg-body-secondary px-3 py-2 rounded-3 mb-4 fs-5 w-auto interactive-pronunciation"
                            style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
                            title="Sesli Dinle"
                            onClick={() => onSpeak && onSpeak(word.term)}
                            onMouseEnter={e => e.currentTarget.classList.add('shadow-sm')}
                            onMouseLeave={e => e.currentTarget.classList.remove('shadow-sm')}
                        >
                            <i className="bi bi-volume-up-fill me-2 text-primary" style={{ fontSize: '24px' }}></i> /{word.pronunciation}/
                        </div>
                    )}

                    {word.shortMeanings && (
                        <div className="mb-4">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Kısa Anlamları</h5>
                            <p className="fs-5 fw-medium">{word.shortMeanings}</p>
                        </div>
                    )}

                    {word.generalDefinition && (
                        <div className="mb-4 bg-primary bg-opacity-10 border-start border-primary border-4 p-4 rounded-4">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Genel Tanımı</h5>
                            <p className="m-0 fs-5">{word.generalDefinition}</p>
                        </div>
                    )}

                    {word.meanings && word.meanings.length > 0 && (
                        <div className="mb-5">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-4">Anlamları ve Örnek Cümleler</h5>
                            <div className="d-flex flex-column gap-3">
                                {word.meanings.map((m, idx) => (
                                    <div key={idx} className="meaning-item bg-body shadow-sm p-4 rounded-4 border border-opacity-10">
                                        <h5 className="d-flex align-items-center flex-wrap gap-2 mb-3 fw-bold lh-base">
                                            <Badge bg="primary" className="fw-semibold px-2 py-1 me-2">{m.context || `Anlamı ${idx + 1}`}</Badge>
                                            {m.definition}
                                        </h5>
                                        {m.examples && m.examples.length > 0 && (
                                            <div className="ms-md-4 ms-2 d-flex flex-column gap-2 mt-3">
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
                                                            <div key={exIdx} className="position-relative pe-3 ps-3 fs-6 mb-3">
                                                                <span className="position-absolute start-0 text-primary fw-bold">•</span>
                                                                {label && <div className="fw-bold text-primary small mb-1 opacity-75">{label}</div>}
                                                                <div className="fst-italic text-body mb-1 lh-sm">"{engPart}"</div>
                                                                {trPart && <div className="text-muted fst-italic small ps-2 border-start border-2 border-primary ms-1 mt-1">{trPart}</div>}
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
                                {word.collocations.map((item, i) => <li key={i} className="fs-6">{item}</li>)}
                            </ul>
                        </div>
                    )}

                    {word.idioms && word.idioms.length > 0 && (
                        <div className="mb-4">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Deyimler (Idioms)</h5>
                            <ul className="custom-ul">
                                {word.idioms.map((item, i) => <li key={i} className="fs-6">{item}</li>)}
                            </ul>
                        </div>
                    )}

                    {word.wordFamily && word.wordFamily.length > 0 && (
                        <div className="mb-4">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Kelime Ailesi (Word Family)</h5>
                            <ul className="custom-ul">
                                {word.wordFamily.map((item, i) => <li key={i} className="fs-6">{item}</li>)}
                            </ul>
                        </div>
                    )}

                    {word.cefrLevel && (
                        <div className="mb-4">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Zorluk Seviyesi (CEFR)</h5>
                            <p className="fs-6 m-0 lh-base">{word.cefrLevel}</p>
                        </div>
                    )}

                    {word.grammar && word.grammar.length > 0 && (
                        <div className="mb-4 bg-body p-4 rounded-4 border border-opacity-10 shadow-sm">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Gramer Özellikleri</h5>
                            <ul className="custom-ul m-0">
                                {word.grammar.map((item, i) => <li key={i} className="fs-6">{item}</li>)}
                            </ul>
                        </div>
                    )}

                    {word.tips && word.tips.length > 0 && (
                        <div className="mb-4 bg-danger bg-opacity-10 border-start border-danger border-4 p-4 rounded-4">
                            <h5 className="text-uppercase text-danger fw-bold small letter-spacing-1 border-bottom border-danger border-opacity-25 pb-2 mb-3">Sık Yapılan Hatalar ve İpuçları</h5>
                            {word.tips.map((item, i) => (
                                <p key={i} className="mb-2 text-body fw-medium">{item}</p>
                            ))}
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            {/* RAW TEXT sub-modal */}
            <Modal
                show={showRaw}
                onHide={() => setShowRaw(false)}
                size="lg"
                centered
                style={{ zIndex: 1060 }}
                contentClassName="bg-body-tertiary border border-opacity-25 rounded-4 shadow-lg"
            >
                <Modal.Header closeButton className="border-bottom border-opacity-10 pb-3 px-4">
                    <Modal.Title className="fs-4 fw-bold">Orijinal Şablon</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <textarea
                        className="form-control font-monospace bg-dark text-light border-0 p-4 rounded-3 opacity-75 fs-6"
                        rows={15}
                        readOnly
                        value={word?.raw || 'Bu kelime için orijinal şablon verisi bulunamadı.'}
                        style={{ resize: 'vertical' }}
                    />
                </Modal.Body>
            </Modal>
        </>
    );
}

export default WordDetailModal;
