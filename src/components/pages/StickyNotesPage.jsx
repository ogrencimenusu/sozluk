import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Spinner } from 'react-bootstrap';
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
  setCurrentView,
  dailyStats
}) => {
  const [justUpdatedNoteId, setJustUpdatedNoteId] = useState(null);
  const [expandedDates, setExpandedDates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved'
  const [visibleCount, setVisibleCount] = useState(5);

  const handleToggleExpand = (dateLabel) => {
    setExpandedDates(prev =>
      prev.includes(dateLabel)
        ? prev.filter(d => d !== dateLabel)
        : [...prev, dateLabel]
    );
  };

  const autoSaveTimerRef = useRef(null);
  const observerTarget = useRef(null);
  const hasFocusedTextarea = useRef(false);

  // Reset focus tracker when edit mode changes
  useEffect(() => {
    if (!editingNoteId) {
      hasFocusedTextarea.current = false;
    }
  }, [editingNoteId]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return stickyNotes;
    const query = searchQuery.toLowerCase();
    return stickyNotes.filter(n =>
      (n.title && n.title.toLowerCase().includes(query)) ||
      (n.text && n.text.toLowerCase().includes(query)) ||
      (n.wordTerm && n.wordTerm.toLowerCase().includes(query))
    );
  }, [stickyNotes, searchQuery]);

  const groupedNotes = useMemo(() => {
    const groups = {};
    const displayedNotes = filteredNotes.slice(0, visibleCount);
    const sortedNotes = [...displayedNotes].sort((a, b) => {
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
  }, [filteredNotes, visibleCount]);

  // Reset pagination when searching
  useEffect(() => {
    setVisibleCount(5);
  }, [searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && visibleCount < filteredNotes.length) {
          setVisibleCount(prev => prev + 5);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, filteredNotes.length]);

  // Auto-save logic
  useEffect(() => {
    if (!editingNoteId) {
      setSaveStatus('idle');
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Don't save if text is empty
    if (!inlineEditingText || !inlineEditingText.trim()) return;

    // Set status to saving
    setSaveStatus('saving');

    // Set new timer for auto-save
    autoSaveTimerRef.current = setTimeout(() => {
      handleUpdateNote(editingNoteId, inlineEditingText, inlineEditingTitle);
      setJustUpdatedNoteId(editingNoteId);
      setSaveStatus('saved');
      setTimeout(() => setJustUpdatedNoteId(null), 2000);
    }, 1000); // 1 second debounce

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [inlineEditingText, inlineEditingTitle, editingNoteId, handleUpdateNote]);

  const renderHighlightedText = (text, query) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} style={{ backgroundColor: '#f59e0b', color: 'white', borderRadius: '3px', padding: '0 2px' }}>{part}</mark>
        : part
    );
  };

  const scrollToNote = (id) => {
    const element = document.getElementById(`note-${id}`);
    if (element) {
      const offset = 100; // Account for sticky header
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      // Briefly highlight the jumped note
      element.classList.add('jump-highlight');
      setTimeout(() => element.classList.remove('jump-highlight'), 2000);
    }
  };

  return (
    <Container fluid className="main-app-container animation-fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <PageHeader
        title="Sticky Notlarım"
        icon="bi-pin-angle-fill"
        onBack={() => setCurrentView('home')}
        dailyStats={dailyStats}
      />

      <Row className="g-4">
        {/* Sol Kolon: Başlık Listesi Sidebar - Desktop'ta solda, Mobil'de altta */}
        <Col xs={12} md={5} lg={4} className="order-2 order-md-1">
          <Card className="border-0 shadow-sm rounded-4 h-100 bg-body-tertiary">
            <Card.Header className="bg-transparent border-0 pt-4 pb-2 px-4">
              <h5 className="fw-bold m-0 d-flex align-items-center gap-2 text-primary">
                <i className="bi bi-list-ul"></i> Not Başlıkları
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              {Object.keys(groupedNotes).length === 0 ? (
                <div className="text-muted text-center p-4">Not bulunamadı.</div>
              ) : (
                <div className="d-flex flex-column gap-3 p-4 pt-1" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', overflowX: 'hidden' }}>
                  {Object.entries(groupedNotes).map(([dateLabel, items], idx) => (
                    <div key={idx}>
                      <div className="small fw-bold text-muted mb-2 ps-2" style={{ letterSpacing: '0.5px' }}>{dateLabel}</div>
                      <div className="d-flex flex-column gap-2">
                        {items.slice(0, expandedDates.includes(dateLabel) ? items.length : 4).map((note, i) => (
                          <div
                            key={note.id}
                            className="bg-body shadow-sm p-3 rounded-4 d-flex align-items-center gap-3 interactive-card"
                            style={{ cursor: 'pointer' }}
                            onClick={() => scrollToNote(note.id)}
                          >
                            <div 
                              className={`fw-bold fs-6 flex-grow-1 text-truncate ${note.isCompleted ? 'text-success opacity-75' : ''}`}
                              style={!note.isCompleted ? { color: '#f59e0b' } : {}}
                            >
                              {i + 1}. {note.title || (note.text ? note.text.substring(0, 30) + '...' : 'Başlıksız Not')}
                            </div>
                            {note.isCompleted && <i className="bi bi-check-circle-fill text-success opacity-50"></i>}
                          </div>
                        ))}
                        {items.length > 4 && (
                          <div className="text-center mt-1">
                            <span
                              className="text-primary small fw-medium"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleToggleExpand(dateLabel)}
                            >
                              {expandedDates.includes(dateLabel) ? (
                                <><i className="bi bi-chevron-up"></i> Daha az göster</>
                              ) : (
                                <>({items.length - 4} adet not daha) <i className="bi bi-chevron-down"></i></>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Sağ Kolon: Form ve Liste */}
        <Col xs={12} md={7} lg={8} className="order-1 order-md-2">
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
                    as="textarea"
                    placeholder="Kelime bağlamı olmadan genel bir not ekleyin..."
                    value={manualNoteText}
                    onChange={(e) => setManualNoteText(e.target.value)}
                    className="bg-body-secondary border-0 shadow-none px-4 py-3 rounded-4 flex-grow-1"
                    style={{ resize: 'none', height: '100px' }}
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
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between p-4 border-bottom border-opacity-10 gap-3">
                <h6 className="fw-bold m-0 text-secondary d-flex align-items-center gap-2">
                  <i className="bi bi-card-text"></i> Kaydedilen Notlar
                </h6>
                
                <div className="d-flex align-items-center gap-3">
                  <div className="position-relative">
                    <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                    <Form.Control
                      type="text"
                      placeholder="Notlarda ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-body-secondary border-0 shadow-none ps-5 pe-4 py-2 rounded-pill small"
                      style={{ width: '200px', fontSize: '0.9rem' }}
                    />
                  </div>
                  <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 fw-bold">
                    {filteredNotes.length} Not
                  </span>
                </div>
              </div>

              <div className="p-4">
                {filteredNotes.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-pin-angle fs-1 opacity-25 mb-3 d-block"></i>
                    {searchQuery ? 'Arama sonucu bulunamadı.' : 'Henüz hiç sticky note eklemediniz.'}<br />
                    {!searchQuery && 'Kelimeleri seçerek detayından not ekleyebilirsiniz.'}
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-5">
                    {Object.entries(groupedNotes).map(([dateLabel, items], groupIdx) => (
                      <div key={groupIdx} className="sticky-notes-date-group">
                        <div className="small fw-bold text-muted mb-3 ps-2 d-flex align-items-center gap-2" style={{ letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                          <i className="bi bi-calendar-event opacity-50"></i> {dateLabel}
                        </div>
                        <div className="d-flex flex-column gap-3">
                          {items.map((note) => {
                            const noteDate = note.createdAt?.toDate ? note.createdAt.toDate() : new Date(note.createdAt);
                            const isValidDate = noteDate instanceof Date && !isNaN(noteDate);

                            return (
                              <div
                                key={note.id}
                                id={`note-${note.id}`}
                                className={`sticky-note-list-item d-flex align-items-start gap-3 p-3 overflow-hidden transition-all ${justUpdatedNoteId === note.id ? 'just-updated' : ''} ${note.isCompleted ? 'completed' : ''}`}
                              >
                                <div className={`sticky-note-list-pin flex-shrink-0 ${note.isCompleted ? 'text-success' : ''}`}>
                                  <i className={`bi ${note.isCompleted ? 'bi-check-circle-fill' : 'bi-pin-angle-fill'}`}></i>
                                </div>
                                <div className="flex-grow-1 min-w-0">
                                  {note.wordTerm && (
                                    <div className="sticky-note-list-word-tag mb-2">
                                      <i className="bi bi-link-45deg me-1 opacity-50" style={{ fontSize: '0.8rem' }}></i>
                                      {(note.wordTerm === 'Manuel Not' || note.wordTerm === 'MANUEL NOT' || !note.wordTerm) 
                                        ? 'Not' 
                                        : <>İlişkili Kelime: {renderHighlightedText(note.wordTerm, searchQuery)}</>}
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
                                          if (e.key === 'Escape') {
                                            setEditingNoteId(null);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          // Small delay to allow clicking between title and text without closing
                                          setTimeout(() => {
                                            const activeElement = document.activeElement;
                                            if (
                                              activeElement && 
                                              (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') && 
                                              activeElement.closest('.sticky-note-list-item')
                                            ) {
                                              return;
                                            }
                                            setEditingNoteId(null);
                                          }, 200);
                                        }}
                                        ref={(tag) => {
                                          if (tag) {
                                            tag.style.height = 'auto';
                                            tag.style.height = tag.scrollHeight + 'px';
                                            
                                            // Focus and set cursor to end on initial edit
                                            if (editingNoteId && !hasFocusedTextarea.current) {
                                              tag.focus();
                                              const len = tag.value.length;
                                              tag.setSelectionRange(len, len);
                                              hasFocusedTextarea.current = true;
                                            }
                                          }
                                        }}
                                      />
                                      <div className="d-flex justify-content-end mt-1">
                                        <small className={`transition-all ${saveStatus === 'saved' ? 'text-success' : 'text-muted'} opacity-75`} style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                          {saveStatus === 'saving' ? (
                                            <><i className="bi bi-cloud-arrow-up-fill me-1"></i> Otomatik kaydediliyor...</>
                                          ) : saveStatus === 'saved' ? (
                                            <><i className="bi bi-cloud-check-fill me-1"></i> Düzenleme Kaydedildi</>
                                          ) : null}
                                        </small>
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
                                        <div className={`sticky-note-list-title h6 fw-bold mb-2 ${note.isCompleted ? 'opacity-50' : 'text-body'}`}>
                                          {renderHighlightedText(note.title, searchQuery)}
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
                                        {renderHighlightedText(note.text, searchQuery)}
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Intersection observer target */}
                {filteredNotes.length > visibleCount && (
                  <div ref={observerTarget} className="text-center py-4">
                    <Spinner animation="border" size="sm" variant="primary" className="opacity-50" />
                    <span className="ms-2 text-muted small">Daha eski notlar yükleniyor...</span>
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
