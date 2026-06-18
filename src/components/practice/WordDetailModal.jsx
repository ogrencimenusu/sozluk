import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Row, Col, Badge, Dropdown } from 'react-bootstrap';
import Swal from 'sweetalert2';

/**
 * Splits `text` into segments, wrapping matches from `highlights` in
 * <mark className="sticky-highlight">.
 */
function highlightText(text, highlights) {
  if (!text || !highlights || highlights.length === 0) return text;
  const escaped = highlights
    .filter(h => h && h.length >= 2)
    .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  // Reset lastIndex before each test call
  return parts.map((part, i) => {
    regex.lastIndex = 0;
    return regex.test(part)
      ? <mark key={i} className="sticky-highlight">{part}</mark>
      : part;
  });
}

const parseDate = (val) => {
  if (!val) return null;
  
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {}
  }
  
  if (val && typeof val === 'object' && typeof val.seconds === 'number') {
    try {
      const d = new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {}
  }
  
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
};

const getRelevantNoteText = (noteText, term, isAssociated, forCopy = false) => {
    if (isAssociated || !noteText || !term) {
        if (forCopy) {
            const temp = document.createElement('div');
            temp.innerHTML = noteText;
            return temp.textContent || temp.innerText || noteText;
        }
        return noteText;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = noteText;
    
    const lines = [];
    let currentLineNodes = [];
    const blockTags = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TR', 'TABLE']);
    
    const flushCurrentLine = () => {
        if (currentLineNodes.length > 0) {
            const lineDiv = document.createElement('div');
            currentLineNodes.forEach(node => lineDiv.appendChild(node.cloneNode(true)));
            if (lineDiv.textContent.trim()) {
                lines.push({
                    html: lineDiv.innerHTML,
                    text: lineDiv.textContent.trim()
                });
            }
            currentLineNodes = [];
        }
    };
    
    const traverse = (node) => {
        const isBlock = node.nodeType === 1 && blockTags.has(node.nodeName);
        
        if (node.nodeType === 3) {
            currentLineNodes.push(node);
        } else if (node.nodeType === 1) {
            if (node.nodeName === 'BR') {
                flushCurrentLine();
            } else if (isBlock) {
                flushCurrentLine();
                
                const hasBlockOrBr = Array.from(node.querySelectorAll('*')).some(
                    child => blockTags.has(child.nodeName) || child.nodeName === 'BR'
                );
                
                if (hasBlockOrBr) {
                    Array.from(node.childNodes).forEach(child => traverse(child));
                } else {
                    currentLineNodes.push(node);
                }
                
                flushCurrentLine();
            } else {
                currentLineNodes.push(node);
            }
        }
    };
    
    Array.from(tempDiv.childNodes).forEach(child => traverse(child));
    flushCurrentLine();
    
    if (lines.length === 0) {
        if (forCopy) {
            const temp = document.createElement('div');
            temp.innerHTML = noteText;
            return temp.textContent || temp.innerText || noteText;
        }
        return noteText;
    }
    
    const termLower = term.toLowerCase();
    const relevant = lines.filter(line => line.text.toLowerCase().includes(termLower));
    
    if (relevant.length > 0) {
        if (forCopy) {
            return relevant.map(r => r.text).join('\n\n');
        }
        return relevant.map(r => r.html).join('');
    }
    
    if (forCopy) {
        const temp = document.createElement('div');
        temp.innerHTML = noteText;
        return temp.textContent || temp.innerText || noteText;
    }
    return noteText;
};

/**
 * Shared word detail modal.
 * Props:
 *   word             – the word object to display (or null to hide)
 *   onHide           – callback to close the modal
 *   onSpeak          – (text) => void   speech-synthesis helper
 *   onEdit           – (word) => void   callback to edit the word
 *   stickyNotes      – array of ALL sticky notes
 *   onAddNote        – (wordId, wordTerm, text) => void
 *   onDeleteNote     – (noteId) => void
 *   onOpenNotesModal  – () => void  open sticky notes list modal on highlight click
 *   stickyHighlights – string[] of saved note texts for THIS word (for highlighting)
 */
function WordDetailModal({ 
    word, onHide, onSpeak, onEdit, onToggleStar, onAddToList, 
    customLists = [], onAddWordsToList, onRemoveWordFromList,
    stickyNotes = [], onAddNote, onUpdateNote, onDeleteNote, 
    onUpdateStatus, stickyHighlights = [], onOpenNotesModal 
}) {
    const [selectionTooltip, setSelectionTooltip] = useState(null); // { x, y, text }
    const [savedNoteFlash, setSavedNoteFlash] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editText, setEditText] = useState('');
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteText, setNewNoteText] = useState('');
    const [showTitleDropdown, setShowTitleDropdown] = useState(null); // null, 'new', or note.id
    const [titleSearchTerm, setTitleSearchTerm] = useState('');
    
    const uniqueTitles = React.useMemo(() => {
        const titles = stickyNotes.map(n => n.title).filter(t => t && t.trim() !== '');
        return [...new Set(titles)];
    }, [stickyNotes]);

    const filteredTitles = React.useMemo(() => {
        if (!titleSearchTerm) return uniqueTitles;
        return uniqueTitles.filter(t => t.toLowerCase().includes(titleSearchTerm.toLowerCase()));
    }, [uniqueTitles, titleSearchTerm]);

    const modalBodyRef = useRef(null);
    const tooltipRef = useRef(null);

    // Detect text selection inside modal body
    const handleMouseUp = useCallback((e) => {
        // Small timeout to allow selection to settle
        setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                setSelectionTooltip(null);
                return;
            }
            const selectedText = selection.toString().trim();
            if (!selectedText || selectedText.length < 2) {
                setSelectionTooltip(null);
                return;
            }

            // Make sure selection is inside the modal body
            const range = selection.getRangeAt(0);
            const modalBody = modalBodyRef.current;
            if (!modalBody || !modalBody.contains(range.commonAncestorContainer)) {
                setSelectionTooltip(null);
                return;
            }

            // Position tooltip above the selection
            const rect = range.getBoundingClientRect();
            setSelectionTooltip({
                x: rect.left + rect.width / 2,
                y: Math.max(0, rect.top - 8),
                text: selectedText
            });
        }, 10);
    }, []);

    // Clear tooltip on click outside (but not on the tooltip itself)
    const handleMouseDown = useCallback((e) => {
        if (tooltipRef.current && tooltipRef.current.contains(e.target)) return;
        setSelectionTooltip(null);
    }, []);

    // Selection listener disabled (now manual only)
    /*
    useEffect(() => {
        if (!word) return;
        let timeoutId;
        const handleSelectionChange = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                handleMouseUp();
            }, 300);
        };

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchend', handleMouseUp);
        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('touchstart', handleMouseDown, { passive: true });
        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchend', handleMouseUp);
            document.removeEventListener('selectionchange', handleSelectionChange);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('touchstart', handleMouseDown);
        };
    }, [word, handleMouseUp, handleMouseDown]);
    */

    // Clear tooltip when word changes
    useEffect(() => {
        setSelectionTooltip(null);
        setEditingNoteId(null);
        setIsAddingNote(false);
    }, [word]);

    const handleAddManualNote = () => {
        if (!newNoteText.trim() || !word) return;
        onAddNote && onAddNote(word.id, word.term, newNoteText, newNoteTitle);
        setIsAddingNote(false);
        setNewNoteTitle('');
        setNewNoteText('');
        setSavedNoteFlash(true);
        setTimeout(() => setSavedNoteFlash(false), 2000);
    };

    const handleStartEdit = (note) => {
        setEditingNoteId(note.id);
        setEditTitle(note.title || '');
        setEditText(note.text || '');
    };

    const handleCancelEdit = () => {
        setEditingNoteId(null);
        setEditTitle('');
        setEditText('');
    };

    const handleSaveEdit = () => {
        if (!editingNoteId || !editText.trim()) return;
        onUpdateNote && onUpdateNote(editingNoteId, editText, editTitle);
        setEditingNoteId(null);
    };

    const handleSaveNote = () => {
        if (!selectionTooltip || !word) return;
        onAddNote && onAddNote(word.id, word.term, selectionTooltip.text);
        setSelectionTooltip(null);
        window.getSelection()?.removeAllRanges();
        setSavedNoteFlash(true);
        setTimeout(() => setSavedNoteFlash(false), 2000);
    };

    // Filter notes for current word
    const wordNotes = stickyNotes.filter(n => 
        n.wordId === word?.id || 
        (n.selectedWords && n.selectedWords.some(sw => sw.toLowerCase() === word?.term?.toLowerCase()))
    );

    const handleCopyNote = useCallback((note, isAssociated) => {
        if (!word?.term) return;
        
        const cleanText = getRelevantNoteText(note.text, word.term, isAssociated, true);
        const textToCopy = `${cleanText}\n\n${word.term}`;
        
        const showSuccessToast = () => {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Not metni ve kelime kopyalandı!',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true,
            });
        };

        const fallbackCopy = (text) => {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
                showSuccessToast();
            } catch (e) {
                console.error('Fallback kopyalama hatası:', e);
            }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy)
                .then(showSuccessToast)
                .catch(() => fallbackCopy(textToCopy));
        } else {
            fallbackCopy(textToCopy);
        }
    }, [word]);

    if (!word) return null;

    return (
        <>
            {/* Floating sticky note tooltip disabled */}

            {/* Flash feedback */}
            {savedNoteFlash && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        right: '24px',
                        zIndex: 9999,
                    }}
                    className="sticky-note-flash-toast d-flex align-items-center gap-2"
                >
                    <i className="bi bi-check-circle-fill text-success"></i>
                    <span>Not kaydedildi!</span>
                </div>
            )}

            <Modal
                show={!!word}
                onHide={onHide}
                size="xl"
                centered
                scrollable
                contentClassName="bg-body-tertiary border border-opacity-25 rounded-4 shadow-lg"
            >
                <Modal.Header className="border-bottom border-opacity-10 align-items-center py-3 px-4 px-md-5 bg-body-tertiary">
                    <div className="d-flex align-items-center gap-3">
                        <i
                            className={`bi ${word.isStarred ? 'bi-star-fill text-warning' : 'bi-star text-muted'} fs-3`}
                            style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
                            onClick={(e) => onToggleStar && onToggleStar(e, word)}
                            title={word.isStarred ? "Yıldızı Kaldır" : "Yıldızla"}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        ></i>
                        <div className="d-flex align-items-center flex-wrap gap-2">
                            <Modal.Title className="display-6 fw-bold m-0 text-break text-body">{word.term}</Modal.Title>
                            <Dropdown 
                                className="ms-md-2"
                                onSelect={(eventKey) => {
                                    if (onUpdateStatus && word) {
                                        onUpdateStatus(word.id, eventKey);
                                    }
                                }}
                            >
                                <Dropdown.Toggle 
                                    as={Badge}
                                    bg={word.learningStatus === 'Öğrendi' ? 'success' : word.learningStatus === 'Öğreniyor' ? 'warning' : 'info'} 
                                    pill 
                                    className="px-3 py-2 fw-bold shadow-sm cursor-pointer border-0 d-inline-flex align-items-center gap-2 no-caret"
                                    style={{ fontSize: '0.8rem', letterSpacing: '0.5px' }}
                                >
                                    {word.learningStatus || 'Yeni'}
                                    <i className="bi bi-chevron-down small"></i>
                                </Dropdown.Toggle>

                                <Dropdown.Menu className="shadow-lg border-0 bg-body-tertiary rounded-3 mt-1 py-2">
                                    <Dropdown.Header className="small fw-bold text-muted border-bottom border-opacity-10 mb-2 pb-2">Öğrenim Durumu</Dropdown.Header>
                                    {[
                                        { key: 'Yeni', bg: 'info', icon: 'bi-star' },
                                        { key: 'Öğreniyor', bg: 'warning', icon: 'bi-book' },
                                        { key: 'Öğrendi', bg: 'success', icon: 'bi-check-circle' }
                                    ].map(status => (
                                        <Dropdown.Item 
                                            key={status.key} 
                                            eventKey={status.key}
                                            active={word.learningStatus === status.key || (!word.learningStatus && status.key === 'Yeni')}
                                            className="d-flex align-items-center gap-3 py-2 px-3 transition-all"
                                        >
                                            <div className={`rounded-circle bg-${status.bg} bg-opacity-10 d-flex align-items-center justify-content-center`} style={{ width: '28px', height: '28px' }}>
                                                <i className={`bi ${status.icon} text-${status.bg}`}></i>
                                            </div>
                                            <span className="fw-medium">{status.key}</span>
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </div>
                    <div className="ms-auto d-flex align-items-center gap-2">
                        {(() => {
                            const listsWithWord = customLists?.filter(l => l.wordIds?.includes(word.id)) || [];
                            const listCount = listsWithWord.length;
                            return (
                                <Dropdown align="end" className="d-inline-flex">
                                    <Dropdown.Toggle
                                        variant={listCount > 0 ? "info" : "outline-info"}
                                        size="sm"
                                        className="rounded-pill px-3 shadow-sm bg-body d-flex align-items-center gap-2 no-caret position-relative"
                                        title="Listeye Ekle/Çıkar"
                                    >
                                        <i className="bi bi-collection-play-fill"></i>
                                        <span className="d-none d-md-inline">Listeye Ekle</span>
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

                                    <Dropdown.Menu 
                                        className="shadow-lg border-secondary border-opacity-25 bg-body-tertiary rounded-3" 
                                        style={{ minWidth: '220px', maxHeight: '350px', overflowY: 'auto' }}
                                        popperConfig={{
                                            modifiers: [
                                                {
                                                    name: 'preventOverflow',
                                                    options: {
                                                        boundary: 'viewport',
                                                    },
                                                },
                                                {
                                                    name: 'flip',
                                                    options: {
                                                        fallbackPlacements: ['top', 'bottom'],
                                                    },
                                                },
                                            ],
                                        }}
                                    >
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
                                                const isInList = list.wordIds?.includes(word.id);
                                                return (
                                                    <Dropdown.Item 
                                                        key={list.id} 
                                                        className={`small d-flex align-items-center justify-content-between gap-2 py-2 ${isInList ? 'bg-primary bg-opacity-10' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isInList) {
                                                                onRemoveWordFromList && onRemoveWordFromList(list.id, word.id);
                                                            } else {
                                                                onAddWordsToList && onAddWordsToList(list.id, [word.id]);
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

                <Modal.Body className="p-4 p-md-5 custom-scroll" ref={modalBodyRef}>
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
                        {word.variants && word.variants.length > 0 && (
                            <div className="mt-3 d-flex flex-wrap gap-2">
                                <span className="text-muted small fw-bold text-uppercase letter-spacing-1 d-block w-100 mb-1" style={{ fontSize: '0.7rem' }}>Varyantlar:</span>
                                {word.variants.map((v, i) => (
                                    <Badge key={i} bg="info" className="bg-opacity-10 text-info fw-normal border border-info border-opacity-25" style={{ fontSize: '0.75rem' }}>{v}</Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    {word.shortMeanings && (
                        <div className="mb-4 border-start border-success border-4 ps-4 py-2 position-relative bg-body-secondary bg-opacity-50 rounded-end-4">
                            <i className="bi bi-bookmark-star-fill text-success opacity-25 position-absolute end-0 top-0 m-3" style={{ fontSize: '2rem', transform: 'rotate(15deg)' }}></i>
                            <h6 className="text-uppercase text-success fw-bold small letter-spacing-2 mb-2 d-flex align-items-center gap-2">
                                <i className="bi bi-list-task"></i> Kısa Anlamları
                            </h6>
                            <p className="m-0 fs-6 text-body lh-base pe-5" style={{ fontWeight: '500' }}>
                                {highlightText(word.shortMeanings, stickyHighlights, onOpenNotesModal)}
                            </p>
                        </div>
                    )}

                    {word.generalDefinition && (
                        <div className="mb-4 border-start border-primary border-4 ps-4 py-2 position-relative bg-body-secondary bg-opacity-50 rounded-end-4">
                            <i className="bi bi-info-circle-fill text-primary opacity-25 position-absolute end-0 top-0 m-3" style={{ fontSize: '2rem', transform: 'rotate(15deg)' }}></i>
                            <h6 className="text-uppercase text-primary fw-bold small letter-spacing-2 mb-2 d-flex align-items-center gap-2">
                                <i className="bi bi-journal-text"></i> Genel Tanımı
                            </h6>
                            <p className="m-0 fs-6 text-body lh-base pe-5" style={{ fontWeight: '500' }}>
                                {highlightText(word.generalDefinition, stickyHighlights, onOpenNotesModal)}
                            </p>
                        </div>
                    )}

                    {/* ── STICKY NOTES SECTION (Moved under General Definition) ── */}
                    <div className="sticky-notes-section mb-4">
                        <h5 className="text-uppercase fw-bold small letter-spacing-2 border-bottom border-opacity-10 pb-2 mb-4 d-flex align-items-center gap-2 sticky-notes-title">
                            <i className="bi bi-pin-angle-fill text-warning"></i>
                            Sticky Notlarım
                            {wordNotes.length > 0 && (
                                <span className="badge rounded-pill ms-1" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', fontSize: '0.7rem' }}>
                                    {wordNotes.length}
                                </span>
                            )}
                            <button 
                                className="btn btn-sm btn-link text-primary ms-auto p-0 fw-bold text-decoration-none d-flex align-items-center gap-1"
                                onClick={() => setIsAddingNote(true)}
                                style={{ fontSize: '0.75rem' }}
                            >
                                <i className="bi bi-plus-circle-fill"></i> Not Ekle
                            </button>
                        </h5>

                        {isAddingNote && (
                            <div className="sticky-note-card position-relative mb-4 shadow-sm" style={{ borderLeft: '4px solid #3b82f6' }}>
                                <div className="sticky-note-pin">
                                    <i className="bi bi-pin-angle-fill" style={{ color: '#3b82f6' }}></i>
                                </div>
                                <div className="d-flex flex-column gap-2 mt-2">
                                    <Dropdown 
                                        show={showTitleDropdown === 'new'} 
                                        onToggle={(isOpen, meta) => {
                                            if (meta && meta.source === 'rootClose') {
                                                setShowTitleDropdown(null);
                                            }
                                        }}
                                        className="w-100"
                                    >
                                        <div className="d-flex bg-body rounded align-items-center pe-1">
                                            <input 
                                                type="text" 
                                                className="form-control form-control-sm border-0 shadow-none bg-transparent flex-grow-1" 
                                                placeholder="Başlık / Yorum ekle..."
                                                value={newNoteTitle}
                                                onChange={(e) => setNewNoteTitle(e.target.value)}
                                                onClick={() => setShowTitleDropdown('new')}
                                                autoFocus
                                                style={{ fontWeight: '600', fontSize: '0.9rem', padding: '4px 8px' }}
                                            />
                                            {newNoteTitle && (
                                                <Button 
                                                    variant="link" 
                                                    className="border-0 shadow-none text-muted p-1 text-decoration-none d-flex align-items-center justify-content-center"
                                                    onClick={() => { setNewNoteTitle(''); setShowTitleDropdown('new'); }}
                                                >
                                                    <i className="bi bi-x-circle-fill opacity-50 hover-opacity-100"></i>
                                                </Button>
                                            )}
                                            <Dropdown.Toggle 
                                                variant="link" 
                                                size="sm" 
                                                className="border-0 shadow-none text-muted p-1 text-decoration-none"
                                                onClick={() => setShowTitleDropdown(showTitleDropdown === 'new' ? null : 'new')}
                                                style={{ boxShadow: 'none' }}
                                            >
                                            </Dropdown.Toggle>
                                        </div>
                                        <Dropdown.Menu className="w-100 p-2 shadow-lg border-0 mt-1 rounded-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                            <div className="px-1 pb-2 mb-2 border-bottom border-opacity-10">
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm border-secondary border-opacity-25"
                                                    placeholder="Kayıtlı başlıklarda ara..."
                                                    value={titleSearchTerm}
                                                    onChange={(e) => setTitleSearchTerm(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                />
                                            </div>
                                            {filteredTitles.length === 0 ? (
                                                <div className="text-muted small text-center p-2 fst-italic">Kayıtlı başlık bulunamadı.</div>
                                            ) : (
                                                filteredTitles.map((t, i) => (
                                                    <Dropdown.Item 
                                                        key={i} 
                                                        className="small rounded-2 py-2 text-truncate"
                                                        onClick={() => {
                                                            setNewNoteTitle(t);
                                                            setShowTitleDropdown(null);
                                                        }}
                                                    >
                                                        {t}
                                                    </Dropdown.Item>
                                                ))
                                            )}
                                        </Dropdown.Menu>
                                    </Dropdown>
                                    <textarea 
                                        className="form-control form-control-sm border-0 shadow-none bg-body" 
                                        rows="3"
                                        placeholder="Notunuzu buraya yazın..."
                                        value={newNoteText}
                                        onChange={(e) => setNewNoteText(e.target.value)}
                                        style={{ fontSize: '0.9rem', padding: '8px' }}
                                    ></textarea>
                                    <div className="d-flex justify-content-end gap-2 mt-1">
                                        <button className="btn btn-link btn-sm text-muted text-decoration-none p-0" onClick={() => setIsAddingNote(false)}>İptal</button>
                                        <button className="btn btn-sm btn-primary px-3 rounded-pill shadow-sm" onClick={handleAddManualNote}>Ekle</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {wordNotes.length === 0 ? (
                            <div className="sticky-notes-empty text-center py-4 bg-body-secondary bg-opacity-25 rounded-4 border border-dashed border-opacity-10 mb-4">
                                <i className="bi bi-pin-angle text-muted opacity-25" style={{ fontSize: '2rem' }}></i>
                                <p className="text-muted small mt-2 mb-0">
                                    Henüz notun yok.
                                </p>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3 mb-4">
                                {wordNotes.map((note) => {
                                    const parsedDate = parseDate(note.createdAt);
                                    const dateStr = parsedDate
                                        ? parsedDate.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                        : '';
                                    
                                    const isAssociated = note.wordId === word?.id;
                                    const isEditing = editingNoteId === note.id;

                                    return (
                                        <div 
                                            key={note.id} 
                                            className={`sticky-note-card position-relative ${isEditing ? 'editing' : ''} ${isAssociated ? 'associated-note' : ''}`}
                                            style={isAssociated ? { 
                                                background: 'linear-gradient(135deg, #002c3d 0%, #003d4a 100%)',
                                                border: '1px solid rgba(0, 150, 255, 0.2)'
                                            } : {}}
                                        >
                                            <div className="sticky-note-pin">
                                                <i className="bi bi-pin-angle-fill"></i>
                                            </div>
                                            
                                            {isEditing ? (
                                                <div className="d-flex flex-column gap-2 mt-2">
                                                    <Dropdown 
                                                        show={showTitleDropdown === note.id} 
                                                        onToggle={(isOpen, meta) => {
                                                            if (meta && meta.source === 'rootClose') {
                                                                setShowTitleDropdown(null);
                                                            }
                                                        }}
                                                        className="w-100"
                                                    >
                                                        <div className="d-flex bg-body rounded align-items-center pe-1">
                                                            <input 
                                                                type="text" 
                                                                className="form-control form-control-sm border-0 shadow-none bg-transparent flex-grow-1" 
                                                                placeholder="Başlık / Yorum ekle..."
                                                                value={editTitle}
                                                                onChange={(e) => setEditTitle(e.target.value)}
                                                                onClick={() => setShowTitleDropdown(note.id)}
                                                                style={{ fontWeight: '600', fontSize: '0.9rem', padding: '4px 8px' }}
                                                            />
                                                            {editTitle && (
                                                                <Button 
                                                                    variant="link" 
                                                                    className="border-0 shadow-none text-muted p-1 text-decoration-none d-flex align-items-center justify-content-center"
                                                                    onClick={() => { setEditTitle(''); setShowTitleDropdown(note.id); }}
                                                                >
                                                                    <i className="bi bi-x-circle-fill opacity-50 hover-opacity-100"></i>
                                                                </Button>
                                                            )}
                                                            <Dropdown.Toggle 
                                                                variant="link" 
                                                                size="sm" 
                                                                className="border-0 shadow-none text-muted p-1 text-decoration-none"
                                                                onClick={() => setShowTitleDropdown(showTitleDropdown === note.id ? null : note.id)}
                                                                style={{ boxShadow: 'none' }}
                                                            >
                                                            </Dropdown.Toggle>
                                                        </div>
                                                        <Dropdown.Menu className="w-100 p-2 shadow-lg border-0 mt-1 rounded-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                                            <div className="px-1 pb-2 mb-2 border-bottom border-opacity-10">
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm border-secondary border-opacity-25"
                                                                    placeholder="Kayıtlı başlıklarda ara..."
                                                                    value={titleSearchTerm}
                                                                    onChange={(e) => setTitleSearchTerm(e.target.value)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            {filteredTitles.length === 0 ? (
                                                                <div className="text-muted small text-center p-2 fst-italic">Kayıtlı başlık bulunamadı.</div>
                                                            ) : (
                                                                filteredTitles.map((t, i) => (
                                                                    <Dropdown.Item 
                                                                        key={i} 
                                                                        className="small rounded-2 py-2 text-truncate"
                                                                        onClick={() => {
                                                                            setEditTitle(t);
                                                                            setShowTitleDropdown(null);
                                                                        }}
                                                                    >
                                                                        {t}
                                                                    </Dropdown.Item>
                                                                ))
                                                            )}
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                    <textarea 
                                                        className="form-control form-control-sm border-0 shadow-none bg-body" 
                                                        rows="3"
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        style={{ fontSize: '0.9rem', padding: '8px' }}
                                                    ></textarea>
                                                    <div className="d-flex justify-content-end gap-2 mt-1">
                                                        <button className="btn btn-link btn-sm text-muted text-decoration-none p-0" onClick={handleCancelEdit}>İptal</button>
                                                        <button className="btn btn-sm btn-primary px-3 rounded-pill" onClick={handleSaveEdit}>Kaydet</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {note.title && <div className="sticky-note-title fw-bold small text-primary mb-1">{note.title}</div>}
                                                    <div 
                                                        className="sticky-note-text mb-1" 
                                                        style={{ 
                                                            fontSize: isAssociated ? '0.9rem' : '0.95rem', 
                                                            lineHeight: '1.6',
                                                            color: isAssociated ? 'rgba(255, 255, 255, 0.9)' : 'inherit',
                                                            whiteSpace: 'pre-wrap'
                                                        }}
                                                        dangerouslySetInnerHTML={{ 
                                                            __html: getRelevantNoteText(note.text, word.term, isAssociated, false)
                                                        }} 
                                                    />
                                                    <div className="d-flex align-items-center justify-content-between mt-2">
                                                        <span className="sticky-note-date">{dateStr}</span>
                                                        <div className="d-flex gap-2">
                                                            <button
                                                                className="btn btn-sm sticky-note-copy-btn p-0 opacity-50 hover-opacity-100"
                                                                onClick={() => handleCopyNote(note, isAssociated)}
                                                                title="Notu Kopyala"
                                                                style={{ border: 'none', background: 'none' }}
                                                            >
                                                                <i className="bi bi-clipboard text-success"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm sticky-note-edit-btn p-0 opacity-50 hover-opacity-100"
                                                                onClick={() => handleStartEdit(note)}
                                                                title="Notu Düzenle"
                                                                style={{ border: 'none', background: 'none' }}
                                                            >
                                                                 <i className="bi bi-pencil-square text-primary"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm sticky-note-delete-btn p-0 opacity-50 hover-opacity-100"
                                                                onClick={() => onDeleteNote && onDeleteNote(note.id)}
                                                                title="Notu Sil"
                                                                style={{ border: 'none', background: 'none' }}
                                                            >
                                                                <i className="bi bi-trash3 text-danger"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {word.meanings && word.meanings.length > 0 && (
                        <div className="mb-5">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-4">Anlamları ve Örnek Cümleler</h5>
                            <div className="d-flex flex-column gap-3">
                                {word.meanings.map((m, idx) => (
                                    <div key={idx} className="meaning-item bg-body shadow-sm p-3 rounded-4 border border-opacity-10">
                                        <div className="d-flex align-items-center flex-wrap gap-2 mb-2 fw-bold lh-base">
                                            <Badge bg="primary" className="fw-semibold px-2 py-1 me-1 small" style={{ fontSize: '0.75rem' }}>{m.context || `Anlamı ${idx + 1}`}</Badge>
                                            <Button
                                                variant="link"
                                                className="p-0 text-primary opacity-75 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                                onClick={() => onSpeak && onSpeak(m.definition)}
                                                title="Sesli Dinle"
                                            >
                                                <i className="bi bi-volume-up-fill" style={{ fontSize: '1.1rem' }}></i>
                                            </Button>
                                            <span className="fs-6">{highlightText(m.definition, stickyHighlights, onOpenNotesModal)}</span>
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
                                                                {engPart && (
                                                                    <div className="d-flex align-items-start gap-2 fst-italic text-body mb-0 lh-sm" style={{ fontSize: '0.95rem' }}>
                                                                        <Button
                                                                            variant="link"
                                                                            className="p-0 text-primary opacity-50 hover-opacity-100 transition-all flex-shrink-0"
                                                                            onClick={() => onSpeak && onSpeak(engPart)}
                                                                            title="Sesli Dinle"
                                                                        >
                                                                            <i className="bi bi-volume-up" style={{ fontSize: '1.1rem' }}></i>
                                                                        </Button>
                                                                        <span className="flex-grow-1">"{highlightText(engPart, stickyHighlights, onOpenNotesModal)}"</span>
                                                                    </div>
                                                                )}
                                                                {trPart && <div className={`text-muted fst-italic extra-small ps-2 border-start border-2 border-primary ms-1 ${engPart ? 'mt-0' : ''}`} style={{ fontSize: '0.85rem' }}>{highlightText(trPart, stickyHighlights, onOpenNotesModal)}</div>}
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
                                        <li key={idx} className="fs-6 text-body">{highlightText(syn.trim(), stickyHighlights, onOpenNotesModal)}</li>
                                    ))}
                                </ul>
                            </Col>
                        )}
                        {word.antonyms && (
                            <Col md={6}>
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3">Zıt Anlamlılar</h5>
                                <ul className="custom-ul">
                                    {word.antonyms.split(',').map((ant, idx) => (
                                        <li key={idx} className="fs-6 text-body">{highlightText(ant.trim(), stickyHighlights, onOpenNotesModal)}</li>
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
                                            <div className="fw-medium text-body d-flex align-items-start gap-2">
                                                <Button
                                                    variant="link"
                                                    className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0 mt-0"
                                                    style={{ paddingTop: '2px' }}
                                                    onClick={() => onSpeak && onSpeak(lines[0])}
                                                    title="Sesli Dinle"
                                                >
                                                    <i className="bi bi-volume-up" style={{ fontSize: '1rem' }}></i>
                                                </Button>
                                                <span className="flex-grow-1">{highlightText(lines[0], stickyHighlights, onOpenNotesModal)}</span>
                                            </div>
                                            {lines.slice(1).map((line, li) => (
                                                <div key={li} className="text-muted fst-italic small ps-2 border-start border-2 border-primary ms-1 mt-1">{highlightText(line, stickyHighlights, onOpenNotesModal)}</div>
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
                                            <div className="fw-medium text-body d-flex align-items-start gap-2">
                                                <Button
                                                    variant="link"
                                                    className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0 mt-0"
                                                    style={{ paddingTop: '2px' }}
                                                    onClick={() => onSpeak && onSpeak(lines[0])}
                                                    title="Sesli Dinle"
                                                >
                                                    <i className="bi bi-volume-up" style={{ fontSize: '1rem' }}></i>
                                                </Button>
                                                <span className="flex-grow-1">{highlightText(lines[0], stickyHighlights, onOpenNotesModal)}</span>
                                            </div>
                                            {lines.slice(1).map((line, li) => (
                                                <div key={li} className="text-muted fst-italic small ps-2 border-start border-2 border-primary ms-1 mt-1">{highlightText(line, stickyHighlights, onOpenNotesModal)}</div>
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
                                                <span className="fw-bold text-body">{highlightText(parts[0]?.trim(), stickyHighlights, onOpenNotesModal)}</span>
                                                {parts[1] && <span className="text-muted small ms-2 fst-italic">— {highlightText(parts[1].trim(), stickyHighlights, onOpenNotesModal)}</span>}
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
                                                <span className="text-muted-emphasis fw-semibold me-2">{highlightText(parts[0]?.trim() + ':', stickyHighlights, onOpenNotesModal)}</span>
                                                <span className="text-body">{highlightText(parts.slice(1).join(':').trim(), stickyHighlights, onOpenNotesModal)}</span>
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
                                            {highlightText(content, stickyHighlights, onOpenNotesModal)}
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
