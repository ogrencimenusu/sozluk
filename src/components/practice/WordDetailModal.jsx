import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Row, Col, Badge, Dropdown, Card } from 'react-bootstrap';
import Swal from 'sweetalert2';

/**
 * Splits `text` into segments, wrapping matches from `highlights` in
 * <mark className="sticky-highlight">.
 */
function highlightText(text, highlights, onClick) {
  if (!text || !highlights || highlights.length === 0) return text;
  const escaped = highlights
    .filter(h => h && h.length >= 2)
    .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    regex.lastIndex = 0;
    return regex.test(part)
      ? (
        <mark
          key={i}
          className="sticky-highlight"
          style={onClick ? { cursor: 'pointer' } : undefined}
          onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
        >
          {part}
        </mark>
      )
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

    // Parse values from new template fields safely
    let ipaPart = word?.pronunciation || '';
    let trPart = '';
    if (word?.pronunciation && word.pronunciation.includes('(')) {
      const match = word.pronunciation.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (match) {
        ipaPart = match[1].trim();
        trPart = match[2].trim();
      }
    }

    let wordType = 'N/A';
    let tone = 'N/A';
    let statusStr = 'Yalın';
    let conj = 'N/A';
    
    if (word?.grammar && Array.isArray(word.grammar)) {
      word.grammar.forEach(g => {
        if (g.startsWith('Türü:')) wordType = g.substring(5).trim();
        else if (g.startsWith('Zaman/Çekim:')) statusStr = g.substring(12).trim();
        else if (g.startsWith('Ton:')) tone = g.substring(4).trim();
        else if (g.startsWith('Çekimler:')) conj = g.substring(9).trim();
      });
    }

    const parsePipeItems = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.map(item => ({
          word: item.en || '',
          meaning: item.tr || ''
        })).filter(x => x.word);
      }
      const sep = val.includes(',,') ? ',,' : ',';
      return val.split(sep).map(item => {
        const parts = item.split('|').map(p => p.trim());
        return {
          word: parts[0],
          meaning: parts[1] || ''
        };
      }).filter(x => x.word);
    };

    const synonymItems = parsePipeItems(word?.synonyms);
    const antonymItems = parsePipeItems(word?.antonyms);

    const parseCollocation = (col) => {
      if (!col) return null;
      if (typeof col === 'object' && col.en) {
        return {
          phrase: col.en,
          translation: col.tr || ''
        };
      }
      const parts = col.split('|').map(p => p.trim());
      return {
        phrase: parts[0],
        translation: parts[1] || ''
      };
    };

    const parseFamilyItem = (item) => {
      if (!item) return null;
      const match = item.match(/^(.*?)\s*\(([^)]+)\)$/);
      return {
        word: match ? match[1].trim() : item,
        meaning: match ? match[2].trim() : ''
      };
    };

    let confusable = '';
    let confusableNote = '';
    let mnemonic = '';
    if (word?.tips && Array.isArray(word.tips)) {
      word.tips.forEach(t => {
        if (t.startsWith('Karıştırılabilir:')) {
          confusable = t.substring(17).trim();
        } else if (t.startsWith('Açıklama:')) {
          confusableNote = t.substring(9).trim();
        } else if (t.startsWith('İpucu:')) {
          mnemonic = t.substring(6).trim();
        }
      });
    }

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
                    {/* Hero Section / Word Header */}
                    <div className="mb-4 bg-body rounded-4 p-4 shadow-sm border border-opacity-10">
                        <Row className="align-items-center g-3">
                            <Col md={7}>
                                <div className="d-flex align-items-center gap-3 mb-2 flex-wrap">
                                    {trPart && (
                                        <div
                                            className="d-inline-flex align-items-center bg-primary bg-opacity-10 border border-primary border-opacity-25 text-primary px-3 py-2 rounded-3 fs-5 fw-bold interactive-pronunciation"
                                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                            title="Sesli Dinle"
                                            onClick={() => onSpeak && onSpeak(word.term, word)}
                                        >
                                            <i className="bi bi-volume-up-fill me-2"></i>
                                            {trPart}
                                        </div>
                                    )}
                                    {ipaPart && (
                                        <span className="text-muted font-monospace bg-body-secondary bg-opacity-75 px-3 py-2.5 rounded-3 fs-6">
                                            /{ipaPart.replace(/^\/|\/$/g, '')}/
                                        </span>
                                    )}
                                </div>
                                
                                {word.rootWord && word.rootWord.toLowerCase() !== word.term.toLowerCase() && (
                                    <div className="small text-muted mt-2">
                                        Kök Kelime: <span className="fw-semibold text-primary">{word.rootWord}</span>
                                    </div>
                                )}
                            </Col>
                            <Col md={5} className="d-flex flex-wrap gap-2 justify-content-md-end">
                                {word.language && (
                                    <Badge bg="dark" className="px-3 py-2 fw-semibold text-uppercase bg-opacity-75" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                                        Dil: {word.language}
                                    </Badge>
                                )}
                                {wordType && wordType !== 'N/A' && (
                                    <Badge bg="secondary" className="px-3 py-2 fw-semibold text-uppercase bg-opacity-75" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                                        {wordType}
                                    </Badge>
                                )}
                                {word.cefrLevel && (
                                    <Badge bg="info" className="px-3 py-2 fw-semibold text-uppercase bg-opacity-75" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                                        {word.language?.toLowerCase() === 'japanese' ? 'JLPT:' : word.language?.toLowerCase() === 'arabic' ? 'Seviye:' : 'CEFR:'} {word.cefrLevel}
                                    </Badge>
                                )}
                                {statusStr && statusStr !== 'Yalın' && (
                                    <Badge bg="warning" className="px-3 py-2 fw-semibold text-dark bg-opacity-75" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                                        {statusStr}
                                    </Badge>
                                )}
                                {tone && tone !== 'N/A' && (
                                    <Badge bg="dark" className="px-3 py-2 fw-semibold text-light bg-opacity-75" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                                        Ton: {tone}
                                    </Badge>
                                )}
                            </Col>
                        </Row>
                    </div>

                    <Row className="g-4 mb-4">
                        {/* Left Column: Meanings & Examples */}
                        <Col xs={12} lg={7} className="d-flex flex-column gap-4">
                            {/* Meanings Block */}
                            <div className="mb-2 bg-body rounded-4 p-4 shadow-sm border border-opacity-10">
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-bookmark-fill text-success"></i> Kelime Anlamları
                                </h5>
                                <div className="d-flex flex-column gap-2 mt-3">
                                    {word.meanings && word.meanings.length > 0 ? (
                                        word.meanings.map((m, idx) => (
                                            <div key={idx} className="d-flex align-items-center gap-2.5 p-2.5 px-3 rounded-3 bg-body-secondary bg-opacity-25 hover-bg-opacity-50 transition-all border border-secondary border-opacity-10">
                                                <span className="fs-6 fw-bold text-success" style={{ minWidth: '20px' }}>
                                                    {idx + 1}.
                                                </span>
                                                <span className="fs-6 text-body-emphasis fw-medium">{highlightText(m.definition, stickyHighlights, onOpenNotesModal)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-muted small">Anlam kaydı bulunamadı.</div>
                                    )}
                                </div>
                            </div>

                            {/* Examples Block */}
                            <div className="mb-2 bg-body rounded-4 p-4 shadow-sm border border-opacity-10">
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-chat-left-quote-fill text-primary"></i> Örnek Cümleler
                                </h5>
                                {(() => {
                                    // Extract all distinct examples across meanings
                                    const allExamples = [];
                                    if (word.meanings && Array.isArray(word.meanings)) {
                                        word.meanings.forEach(m => {
                                            if (m.examples && Array.isArray(m.examples)) {
                                                m.examples.forEach(ex => {
                                                    if (ex) {
                                                        const isDup = allExamples.some(ae => {
                                                            if (typeof ae === 'object' && typeof ex === 'object') {
                                                                return ae.en === ex.en;
                                                            }
                                                            return ae === ex;
                                                        });
                                                        if (!isDup) {
                                                            allExamples.push(ex);
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    }

                                    if (allExamples.length === 0) {
                                        return <div className="text-muted small fst-italic py-2">Örnek cümle bulunamadı.</div>;
                                    }

                                    return (
                                        <div className="d-flex flex-column gap-3 mt-3">
                                            {allExamples.map((ex, exIdx) => {
                                                let engPart = '';
                                                let trPart = null;
                                                if (ex) {
                                                    if (typeof ex === 'object' && ex.en) {
                                                        engPart = ex.en;
                                                        trPart = ex.tr || null;
                                                    } else if (typeof ex === 'string') {
                                                        engPart = ex;
                                                        const trimmedEx = ex.trim();
                                                        if (trimmedEx.endsWith(')')) {
                                                            let balance = 0;
                                                            let openParenIdx = -1;
                                                            for (let i = trimmedEx.length - 1; i >= 0; i--) {
                                                                if (trimmedEx[i] === ')') balance++;
                                                                else if (trimmedEx[i] === '(') {
                                                                    balance--;
                                                                    if (balance === 0) {
                                                                        openParenIdx = i;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                            if (openParenIdx !== -1) {
                                                                engPart = trimmedEx.substring(0, openParenIdx).trim();
                                                                trPart = trimmedEx.substring(openParenIdx + 1, trimmedEx.length - 1).trim();
                                                            }
                                                        }
                                                    }
                                                }

                                                // Strip double/single quotes
                                                engPart = engPart.replace(/^['"]|['"]$/g, '').trim();
                                                if (trPart) trPart = trPart.replace(/^['"]|['"]$/g, '').trim();

                                                return (
                                                    <div key={exIdx} className="example-bubble bg-body-secondary bg-opacity-25 rounded-3 p-3 position-relative border-start border-3 border-primary border-opacity-50">
                                                        <div className="d-flex align-items-start gap-2 fs-6">
                                                            <Button
                                                                variant="link"
                                                                className="p-0 text-primary opacity-50 hover-opacity-100 transition-all flex-shrink-0 mt-0.5"
                                                                onClick={() => onSpeak && onSpeak(engPart, word)}
                                                                title="Cümleyi Dinle"
                                                            >
                                                                <i className="bi bi-volume-up" style={{ fontSize: '1.1rem' }}></i>
                                                            </Button>
                                                            <div className="flex-grow-1">
                                                                <span className="fw-medium text-body">"{highlightText(engPart, stickyHighlights, onOpenNotesModal)}"</span>
                                                                {trPart && (
                                                                    <div className="text-muted small fst-italic mt-1.5 pt-1.5 border-top border-secondary border-opacity-10">
                                                                        {highlightText(trPart, stickyHighlights, onOpenNotesModal)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        </Col>

                        {/* Right Column: Synonyms, Antonyms, Collocations */}
                        <Col xs={12} lg={5} className="d-flex flex-column gap-4">
                            {/* Synonyms */}
                            <div>
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-shuffle text-primary"></i> Eş Anlamlılar
                                </h5>
                                {synonymItems.length > 0 ? (
                                    <div className="d-flex flex-wrap gap-2">
                                        {synonymItems.map((item, idx) => (
                                            <Badge key={idx} bg="primary" className="bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 fw-medium rounded-pill d-flex align-items-center gap-1.5" style={{ fontSize: '0.85rem' }}>
                                                <span className="fw-bold">{item.word}</span>
                                                {item.meaning && <span className="opacity-75 small">({item.meaning})</span>}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted small fst-italic">Eş anlamlı kaydı bulunamadı.</div>
                                )}
                            </div>

                            {/* Antonyms */}
                            <div>
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-arrow-left-right text-danger"></i> Zıt Anlamlılar
                                </h5>
                                {antonymItems.length > 0 ? (
                                    <div className="d-flex flex-wrap gap-2">
                                        {antonymItems.map((item, idx) => (
                                            <Badge key={idx} bg="danger" className="bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-2 fw-medium rounded-pill d-flex align-items-center gap-1.5" style={{ fontSize: '0.85rem' }}>
                                                <span className="fw-bold">{item.word}</span>
                                                {item.meaning && <span className="opacity-75 small">({item.meaning})</span>}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted small fst-italic">Zıt anlamlı kaydı bulunamadı.</div>
                                )}
                            </div>

                            {/* Collocations & Patterns */}
                            <div>
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-hash text-warning"></i> Kalıplar ve Öbekler
                                </h5>
                                {word.collocations && word.collocations.length > 0 ? (
                                    <div className="d-flex flex-column gap-2 bg-body rounded-4 p-3 border border-opacity-10 shadow-sm">
                                        {word.collocations.map((c, i) => {
                                            const parsed = parseCollocation(c);
                                            if (!parsed) return null;
                                            return (
                                                <div key={i} className="d-flex align-items-center gap-2 pb-2 border-bottom border-opacity-10 last-child-border-0">
                                                    <Button
                                                        variant="link"
                                                        className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none"
                                                        onClick={() => onSpeak && onSpeak(parsed.phrase, word)}
                                                        title="Sesli Dinle"
                                                    >
                                                        <i className="bi bi-volume-up" style={{ fontSize: '1rem' }}></i>
                                                    </Button>
                                                    <div className="fs-6">
                                                        <span className="fw-semibold text-body-emphasis">{highlightText(parsed.phrase, stickyHighlights, onOpenNotesModal)}</span>
                                                        {parsed.translation && <span className="text-muted ms-2">— {highlightText(parsed.translation, stickyHighlights, onOpenNotesModal)}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-muted small fst-italic">Kalıp kaydı bulunamadı.</div>
                                )}
                            </div>
                        </Col>
                    </Row>

                    {/* Word Conjugations (CONJUGATION) */}
                    {conj && conj !== 'N/A' && (
                        <div className="mb-4 bg-body rounded-4 p-4 shadow-sm border border-opacity-10">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-2 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                <i className="bi bi-file-earmark-code-fill text-primary"></i> {
                                    word.language?.toLowerCase() === 'japanese' ? 'Kelime Çekimleri (Ta/Te/Nai)' :
                                    word.language?.toLowerCase() === 'arabic' ? 'Kelime Çekimleri (Mazi/Muzari/Masdar)' :
                                    'Kelime Çekimleri (Conjugations)'
                                }
                            </h5>
                            <div className="d-flex flex-wrap gap-2 mt-3">
                                {conj.split('|').map((part, idx) => {
                                    const subParts = part.split(':').map(p => p.trim());
                                    if (subParts.length < 2) return null;
                                    return (
                                        <Badge key={idx} bg="secondary" className="bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-3 py-2.5 fw-medium rounded-3" style={{ fontSize: '0.9rem' }}>
                                            <span className="fw-bold text-primary">{subParts[0]}</span>: {subParts[1]}
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Special Note (SPECIAL_NOTE) */}
                    {word.specialNote && word.specialNote !== 'N/A' && (
                        <div className="mb-4 bg-body rounded-4 p-4 shadow-sm border border-opacity-10">
                            <h5 className="text-uppercase text-muted fw-bold small letter-spacing-1 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                <i className="bi bi-info-circle-fill text-info"></i> {
                                    word.language?.toLowerCase() === 'japanese' ? 'Kanji / Dil Bilgisi Detayı' :
                                    word.language?.toLowerCase() === 'arabic' ? 'Kök Harfleri (Sülasi) & Not' :
                                    'Dil Bilgisi / Kelime Notu'
                                }
                            </h5>
                            <div className="text-body-emphasis mt-3 p-3 bg-body-secondary bg-opacity-25 rounded-3 border border-secondary border-opacity-10" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                                {highlightText(word.specialNote, stickyHighlights, onOpenNotesModal)}
                            </div>
                        </div>
                    )}

                    {/* Word Family (TABLO) */}
                    {(() => {
                        const splitByCommaOutsideParentheses = (str) => {
                            const result = [];
                            let current = '';
                            let depth = 0;
                            for (let i = 0; i < str.length; i++) {
                                const char = str[i];
                                if (char === '(') {
                                    depth++;
                                    current += char;
                                } else if (char === ')') {
                                    depth = Math.max(0, depth - 1);
                                    current += char;
                                } else if (char === ',' && depth === 0) {
                                    result.push(current.trim());
                                    current = '';
                                } else {
                                    current += char;
                                }
                            }
                            if (current.trim()) {
                                result.push(current.trim());
                            }
                            return result;
                        };

                        let familyList = [];
                        if (word.wordFamily) {
                            let rawItems = [];
                            if (Array.isArray(word.wordFamily)) {
                                // Join and split to fix any bad splits that may have happened in database
                                const joined = word.wordFamily.join(', ');
                                rawItems = splitByCommaOutsideParentheses(joined);
                            } else if (typeof word.wordFamily === 'string') {
                                rawItems = splitByCommaOutsideParentheses(word.wordFamily);
                            }

                            rawItems.forEach(item => {
                                const cleaned = item.replace(/^(Diğer Haller:|Kelime Ailesi:)\s*/i, '');
                                if (cleaned.trim()) {
                                    familyList.push(cleaned.trim());
                                }
                            });
                        }

                        if (familyList.length === 0) return null;

                        return (
                            <div className="mb-4 bg-body rounded-4 p-4 shadow-sm border border-opacity-10">
                                <h5 className="text-uppercase text-muted fw-bold small letter-spacing-2 border-bottom border-opacity-10 pb-2 mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-diagram-3-fill text-primary"></i> Kelime Ailesi (Word Family)
                                </h5>
                                <div className="d-flex flex-wrap gap-3 mt-3">
                                    {familyList.map((item, i) => {
                                        const parsed = parseFamilyItem(item);
                                        if (!parsed) return null;
                                        const isCurrent = parsed.word.toLowerCase() === word.term.toLowerCase();
                                        return (
                                            <Card key={i} className={`flex-grow-1 border-0 shadow-xs rounded-3 ${isCurrent ? 'bg-primary bg-opacity-10 border border-primary border-opacity-25' : 'bg-body-secondary bg-opacity-50'}`} style={{ minWidth: '160px' }}>
                                                <Card.Body className="p-3 text-center">
                                                    <div className={`fw-bold fs-6 ${isCurrent ? 'text-primary' : 'text-body-emphasis'}`}>{highlightText(parsed.word, stickyHighlights, onOpenNotesModal)}</div>
                                                    {parsed.meaning && <div className="text-muted small mt-1">{highlightText(parsed.meaning, stickyHighlights, onOpenNotesModal)}</div>}
                                                </Card.Body>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Confusables & Mnemonics */}
                    {(confusable || mnemonic) && (
                        <Row className="g-4 mb-4">
                            {confusable && (
                                <Col md={mnemonic ? 6 : 12}>
                                    <div className="bg-danger bg-opacity-10 border-start border-danger border-4 p-4 rounded-end-4 h-100 position-relative overflow-hidden">
                                        <h5 className="text-uppercase text-danger fw-bold small letter-spacing-2 mb-2 d-flex align-items-center gap-2">
                                            <i className="bi bi-exclamation-circle-fill"></i> Dikkat: Karışabilir!
                                        </h5>
                                        <div className="fw-semibold text-danger-emphasis mb-2" style={{ fontSize: '1.05rem' }}>
                                            Bununla Karıştırmayın: <span className="badge bg-danger text-white rounded-pill px-3 py-1.5 ms-1 fw-bold">{confusable}</span>
                                        </div>
                                        {confusableNote && confusableNote !== 'N/A' && (
                                            <p className="text-body-secondary m-0 small lh-base" style={{ fontWeight: '500' }}>
                                                {highlightText(confusableNote, stickyHighlights, onOpenNotesModal)}
                                            </p>
                                        )}
                                    </div>
                                </Col>
                            )}
                            
                            {mnemonic && (
                                <Col md={confusable ? 6 : 12}>
                                    <div className="bg-warning bg-opacity-10 border-start border-warning border-4 p-4 rounded-end-4 h-100 position-relative overflow-hidden">
                                        <h5 className="text-uppercase text-warning fw-bold text-warning-emphasis small letter-spacing-2 mb-2 d-flex align-items-center gap-2">
                                            <i className="bi bi-lightbulb-fill"></i> Akılda Tutma İpucu
                                        </h5>
                                        <p className="text-body-secondary m-0 small lh-base" style={{ fontWeight: '500' }}>
                                            {highlightText(mnemonic, stickyHighlights, onOpenNotesModal)}
                                        </p>
                                    </div>
                                </Col>
                            )}
                        </Row>
                    )}

                    {/* ── STICKY NOTES SECTION ── */}
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
                </Modal.Body>
            </Modal>
        </>
    );
}

export default WordDetailModal;
