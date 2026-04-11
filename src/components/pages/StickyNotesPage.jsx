import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';

const StickyNotesPage = ({
  stickyNotes,
  manualNoteText,
  setManualNoteText,
  handleAddNote,
  handleDeleteNote,
  editingNoteId,
  setEditingNoteId,
  inlineEditingText,
  setInlineEditingText,
  handleUpdateNote,
  theme,
  toggleTheme,
  setCurrentView,
  dailyStats
}) => {
  const [justUpdatedNoteId, setJustUpdatedNoteId] = useState(null);

  const handleUpdateWithFeedback = (noteId, text, wordId, wordTerm) => {
    handleUpdateNote(noteId, text, wordId, wordTerm);
    setJustUpdatedNoteId(noteId);
    setTimeout(() => setJustUpdatedNoteId(null), 3000);
    setEditingNoteId(null);
  };

  return (
    <Container fluid className="main-app-container animation-fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <PageHeader 
        title="Sticky Notlarım" 
        icon="bi-pin-angle-fill" 
        onBack={() => setCurrentView('home')} 
        dailyStats={dailyStats} 
      />

      <Row className="justify-content-center mx-0">
        <Col md={10} lg={8}>
          {/* Yeni Not Ekleme Alanı */}
          <Card className="border-0 shadow-sm rounded-4 mb-4 bg-body-tertiary">
            <Card.Body className="p-4">
              <h6 className="fw-bold mb-3 text-primary d-flex align-items-center gap-2">
                <i className="bi bi-pencil-square"></i> Hızlı Not Ekle
              </h6>
              <div className="d-flex flex-column flex-sm-row gap-3 align-items-start align-items-sm-center">
                <Form.Control
                  type="text"
                  placeholder="Kelime bağlamı olmadan genel bir not ekleyin..."
                  value={manualNoteText}
                  onChange={(e) => setManualNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNote(null, null, manualNoteText);
                    }
                  }}
                  className="bg-body-secondary border-0 shadow-none px-4 py-3 rounded-pill flex-grow-1"
                />
                <Button 
                  variant="primary" 
                  className="rounded-pill px-4 py-2 fw-semibold shadow-sm text-nowrap d-flex align-items-center gap-2"
                  onClick={() => handleAddNote(null, null, manualNoteText)}
                  disabled={!manualNoteText.trim()}
                >
                  <i className="bi bi-plus-lg"></i> Not Ekle
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Not Listesi */}
          <Card className="border-0 shadow-sm rounded-4 bg-body-tertiary">
            <Card.Body className="p-0">
              <div className="d-flex align-items-center justify-content-between p-4 border-bottom border-opacity-10">
                <h6 className="fw-bold m-0 text-secondary d-flex align-items-center gap-2">
                  <i className="bi bi-card-text"></i> Kaydedilen Notlar
                </h6>
                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 fw-bold">
                  {stickyNotes.length} Not
                </span>
              </div>
              
              <div className="p-4">
                {stickyNotes.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-pin-angle fs-1 opacity-25 mb-3 d-block"></i>
                    Henüz hiç sticky note eklemediniz.<br />Kelimeleri seçerek detayından not ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {stickyNotes.map((note) => {
                      const noteDate = note.createdAt?.toDate ? note.createdAt.toDate() : new Date(note.createdAt);
                      const isValidDate = noteDate instanceof Date && !isNaN(noteDate);
                      
                      return (
                        <div 
                          key={note.id} 
                          className={`sticky-note-list-item d-flex align-items-start gap-3 p-3 overflow-hidden ${justUpdatedNoteId === note.id ? 'just-updated' : ''}`}
                        >
                          <div className="sticky-note-list-pin flex-shrink-0">
                            <i className="bi bi-pin-angle-fill"></i>
                          </div>
                          <div className="flex-grow-1 min-w-0">
                            {note.wordTerm && (
                              <div className="sticky-note-list-word-tag mb-2">
                                <i className="bi bi-link-45deg me-1 opacity-50" style={{ fontSize: '0.8rem' }}></i>
                                {(note.wordTerm === 'Manuel Not' || note.wordTerm === 'MANUEL NOT' || !note.wordTerm) ? 'Not' : `İlişkili Kelime: ${note.wordTerm}`}
                              </div>
                            )}
                            
                            {editingNoteId === note.id ? (
                              <div className="mb-2">
                                <Form.Control
                                  as="textarea"
                                  value={inlineEditingText}
                                  onChange={(e) => setInlineEditingText(e.target.value)}
                                  className="border border-opacity-25 shadow-none bg-body mb-2 rounded-3 p-3"
                                  style={{ 
                                    resize: 'none', 
                                    borderColor: '#f59e0b',
                                    height: 'auto',
                                    overflow: 'hidden'
                                  }}
                                  onInput={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleUpdateWithFeedback(note.id, inlineEditingText, note.wordId, note.wordTerm);
                                    } else if (e.key === 'Escape') {
                                      setEditingNoteId(null);
                                    }
                                  }}
                                  ref={(tag) => {
                                    if (tag) {
                                      tag.style.height = 'auto';
                                      tag.style.height = tag.scrollHeight + 'px';
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className="d-flex justify-content-end gap-2">
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    className="rounded-pill px-3 fw-semibold"
                                    onClick={() => setEditingNoteId(null)}
                                  >
                                    Vazgeç
                                  </Button>
                                  <Button
                                    variant="warning"
                                    size="sm"
                                    className="rounded-pill px-4 fw-bold text-dark shadow-sm"
                                    onClick={() => handleUpdateWithFeedback(note.id, inlineEditingText, note.wordId, note.wordTerm)}
                                  >
                                    Kaydet
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="sticky-note-list-text mb-2 bg-body p-3 rounded-3 border border-opacity-10 shadow-sm cursor-pointer"
                                style={{ 
                                  cursor: 'pointer', 
                                  backgroundColor: theme === 'light' ? '#fef9c3 !important' : 'rgba(234, 179, 8, 0.1) !important',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word'
                                }}
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setInlineEditingText(note.text);
                                }}
                              >
                                {note.text}
                              </div>
                            )}
                            
                            <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                              <span className="sticky-note-list-date d-flex align-items-center gap-1">
                                <i className="bi bi-calendar3"></i> 
                                {isValidDate ? noteDate.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                              </span>
                              <a
                                href="#!"
                                className="sticky-note-list-delete fw-semibold d-flex align-items-center gap-1 text-danger"
                                onClick={(e) => { e.preventDefault(); handleDeleteNote(note.id); }}
                              >
                                <i className="bi bi-trash"></i> Sil
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default StickyNotesPage;
