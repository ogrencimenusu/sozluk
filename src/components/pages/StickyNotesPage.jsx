import React, { useState, useMemo } from 'react';
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';

const StickyNotesPage = ({
  stickyNotes,
  manualNoteText,
  setManualNoteText,
  manualNoteTitle,
  setManualNoteTitle,
  handleAddNote,
  handleDeleteNote,
  handleToggleNoteCompletion,
  editingNoteId,
  setEditingNoteId,
  inlineEditingText,
  setInlineEditingText,
  inlineEditingTitle,
  setInlineEditingTitle,
  handleUpdateNote,
  theme,
  toggleTheme,
  setCurrentView,
  dailyStats
}) => {
  const [justUpdatedNoteId, setJustUpdatedNoteId] = useState(null);
  const [expandedDates, setExpandedDates] = useState([]);

  const handleToggleExpand = (dateLabel) => {
    setExpandedDates(prev =>
      prev.includes(dateLabel)
        ? prev.filter(d => d !== dateLabel)
        : [...prev, dateLabel]
    );
  };

  const handleUpdateWithFeedback = (noteId, text, title) => {
    handleUpdateNote(noteId, text, title);
    setJustUpdatedNoteId(noteId);
    setTimeout(() => setJustUpdatedNoteId(null), 3000);
    setEditingNoteId(null);
  };

  const groupedNotes = useMemo(() => {
    const groups = {};
    const sortedNotes = [...stickyNotes].sort((a, b) => {
      const aVal = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const bVal = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      return bVal - aVal;
    });

    sortedNotes.forEach(note => {
      const dateObj = note.createdAt ? (note.createdAt.toDate ? note.createdAt.toDate() : new Date(note.createdAt)) : new Date();
      const opts = { day: 'numeric', month: 'long', year: 'numeric' };
      const dateStr = dateObj.toLocaleDateString('tr-TR', opts);

      const today = new Date().toLocaleDateString('tr-TR', opts);
      const yesterdayObj = new Date();
      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
      const yesterday = yesterdayObj.toLocaleDateString('tr-TR', opts);

      let key = dateStr;
      if (dateStr === today) key = "Bugün";
      else if (dateStr === yesterday) key = "Dün";

      if (!groups[key]) groups[key] = [];
      groups[key].push(note);
    });

    return groups;
  }, [stickyNotes]);

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
              <div className="d-flex flex-column gap-3">
                <Form.Control
                  type="text"
                  placeholder="Not Başlığı (İsteğe bağlı)..."
                  value={manualNoteTitle}
                  onChange={(e) => setManualNoteTitle(e.target.value)}
                  className="bg-body-secondary border-0 shadow-none px-4 py-3 rounded-pill"
                />
                <div className="d-flex flex-column flex-sm-row gap-3 align-items-start align-items-sm-center">
                  <Form.Control
                    type="text"
                    placeholder="Kelime bağlamı olmadan genel bir not ekleyin..."
                    value={manualNoteText}
                    onChange={(e) => setManualNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNote(null, null, manualNoteText, manualNoteTitle);
                      }
                    }}
                    className="bg-body-secondary border-0 shadow-none px-4 py-3 rounded-pill flex-grow-1"
                  />
                  <Button
                    variant="primary"
                    className="rounded-pill px-4 py-3 fw-semibold shadow-sm text-nowrap d-flex align-items-center gap-2"
                    onClick={() => handleAddNote(null, null, manualNoteText, manualNoteTitle)}
                    disabled={!manualNoteText.trim()}
                  >
                    <i className="bi bi-plus-lg"></i> Not Ekle
                  </Button>
                </div>
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
                  <div className="d-flex flex-column gap-5">
                    {Object.entries(groupedNotes).map(([dateLabel, items], groupIdx) => (
                      <div key={groupIdx} className="sticky-notes-date-group">
                        <div className="small fw-bold text-muted mb-3 ps-2 d-flex align-items-center gap-2" style={{ letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                          <i className="bi bi-calendar-event opacity-50"></i> {dateLabel}
                        </div>
                        <div className="d-flex flex-column gap-3">
                          {items.slice(0, expandedDates.includes(dateLabel) ? items.length : 4).map((note) => {
                            const noteDate = note.createdAt?.toDate ? note.createdAt.toDate() : new Date(note.createdAt);
                            const isValidDate = noteDate instanceof Date && !isNaN(noteDate);

                            return (
                              <div
                                key={note.id}
                                className={`sticky-note-list-item d-flex align-items-start gap-3 p-3 overflow-hidden ${justUpdatedNoteId === note.id ? 'just-updated' : ''} ${note.isCompleted ? 'completed' : ''}`}
                              >
                                <div className={`sticky-note-list-pin flex-shrink-0 ${note.isCompleted ? 'text-success' : ''}`}>
                                  <i className={`bi ${note.isCompleted ? 'bi-check-circle-fill' : 'bi-pin-angle-fill'}`}></i>
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
                                      {/* Title Edit Input */}
                                      <Form.Control
                                        type="text"
                                        value={inlineEditingTitle}
                                        onChange={(e) => setInlineEditingTitle(e.target.value)}
                                        placeholder="Not Başlığı (İsteğe bağlı)..."
                                        className="border border-opacity-25 shadow-none bg-body mb-2 rounded-3 px-3 py-2 fw-bold text-body"
                                        style={{ borderColor: '#f59e0b' }}
                                        autoFocus
                                      />
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
                                            handleUpdateWithFeedback(note.id, inlineEditingText, inlineEditingTitle);
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
                                          onClick={() => handleUpdateWithFeedback(note.id, inlineEditingText, inlineEditingTitle)}
                                        >
                                          Kaydet
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className="cursor-pointer"
                                      onClick={() => {
                                        setEditingNoteId(note.id);
                                        setInlineEditingText(note.text);
                                        setInlineEditingTitle(note.title || '');
                                      }}
                                    >
                                      {note.title && (
                                        <div className={`sticky-note-list-title h6 fw-bold mb-2 ${note.isCompleted ? 'text-decoration-line-through opacity-50' : 'text-body'}`}>
                                          {note.title}
                                        </div>
                                      )}

                                      <div
                                        className="sticky-note-list-text mb-2 bg-body p-3 rounded-3 border border-opacity-10 shadow-sm"
                                        style={{
                                          backgroundColor: theme === 'light' ? '#fef9c3 !important' : 'rgba(234, 179, 8, 0.1) !important',
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word'
                                        }}
                                      >
                                        {note.text}
                                      </div>
                                    </div>
                                  )}

                                  <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                                    <span className="sticky-note-list-date d-flex align-items-center gap-1">
                                      <i className="bi bi-clock"></i>
                                      {isValidDate ? noteDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </span>
                                    <div className="d-flex gap-3 align-items-center">
                                      <a
                                        href="#!"
                                        className={`sticky-note-list-complete fw-semibold d-flex align-items-center gap-1 ${note.isCompleted ? 'text-secondary' : 'text-success'}`}
                                        onClick={(e) => { e.preventDefault(); handleToggleNoteCompletion(note.id, note.isCompleted); }}
                                      >
                                        <i className={`bi ${note.isCompleted ? 'bi-arrow-counterclockwise' : 'bi-check2-circle'}`}></i>
                                        {note.isCompleted ? 'Geri Al' : 'Tamamlandı'}
                                      </a>
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
                              </div>
                            );
                          })}
                          {items.length > 4 && (
                            <div className="text-center mt-2">
                              <span
                                className="text-primary small fw-semibold"
                                style={{ cursor: 'pointer', letterSpacing: '0.3px' }}
                                onClick={() => handleToggleExpand(dateLabel)}
                              >
                                {expandedDates.includes(dateLabel) ? (
                                  <><i className="bi bi-chevron-up me-1"></i> Daha az göster</>
                                ) : (
                                  <><i className="bi bi-chevron-down me-1"></i> ({items.length - 4} adet not daha)</>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
