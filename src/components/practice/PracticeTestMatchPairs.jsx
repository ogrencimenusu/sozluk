import React, { useState, useEffect, useMemo } from 'react';
import { Container, Button, Card, Row, Col, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';

export default function PracticeTestMatchPairs({ questions, words, onClose, onHome, initialTestState }) {
    const [cards, setCards] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [matchedIds, setMatchedIds] = useState([]);
    const [mistakes, setMistakes] = useState(0);
    const [completed, setCompleted] = useState(false);
    
    // Chunking to avoid overcrowded screen
    const [chunkIndex, setChunkIndex] = useState(0);
    const chunkSize = 6; // 6 pairs = 12 cards per screen

    const currentPairs = useMemo(() => {
        const pairs = [];
        questions.forEach(q => {
            const w = words.find(w => w.id === q.wordId);
            if (w) pairs.push({ id: w.id, eng: w.term, tr: w.shortMeanings || w.generalDefinition || 'Anlam yok', audio: w.pronunciation });
        });
        return pairs;
    }, [questions, words]);

    const totalChunks = Math.ceil(currentPairs.length / chunkSize);

    useEffect(() => {
        if (currentPairs.length === 0) return;
        const currentChunk = currentPairs.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize);
        
        const newCards = [];
        currentChunk.forEach(p => {
            newCards.push({ uniqueId: `eng-${p.id}`, wordId: p.id, text: p.eng, type: 'eng', audio: p.audio });
            newCards.push({ uniqueId: `tr-${p.id}`, wordId: p.id, text: p.tr, type: 'tr' });
        });
        
        // Shuffle
        setCards(newCards.sort(() => Math.random() - 0.5));
        setSelectedIds([]);
        setMatchedIds([]);
    }, [currentPairs, chunkIndex]);

    const handleCardClick = (card) => {
        if (completed) return;
        if (matchedIds.includes(card.uniqueId)) return;
        if (selectedIds.includes(card.uniqueId)) return;

        if (card.audio && card.type === 'eng') {
             // Pronounce word
             if ('speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                  const utterance = new SpeechSynthesisUtterance(card.audio || card.text);
                  utterance.lang = 'en-US';
                  window.speechSynthesis.speak(utterance);
             }
        }

        const newSelected = [...selectedIds, card.uniqueId];
        setSelectedIds(newSelected);

        if (newSelected.length === 2) {
            const card1 = cards.find(c => c.uniqueId === newSelected[0]);
            const card2 = cards.find(c => c.uniqueId === newSelected[1]);

            if (card1.wordId === card2.wordId && card1.type !== card2.type) {
                // Match!
                setTimeout(() => {
                    setMatchedIds(prev => [...prev, card1.uniqueId, card2.uniqueId]);
                    setSelectedIds([]);
                    
                    if (matchedIds.length + 2 === cards.length) { // chunk completed
                        if (chunkIndex + 1 < totalChunks) {
                            Swal.fire({
                                title: 'Harika!',
                                text: 'Sonraki seviyeye geçiliyor...',
                                icon: 'success',
                                timer: 1500,
                                showConfirmButton: false
                            }).then(() => {
                                setChunkIndex(prev => prev + 1);
                            });
                        } else {
                            handleFinish();
                        }
                    }
                }, 400);
            } else {
                // Wrong
                setMistakes(m => m + 1);
                setTimeout(() => {
                    setSelectedIds([]);
                }, 800);
            }
        }
    };

    const handleFinish = () => {
        setCompleted(true);
        Swal.fire({
            title: 'Tebrikler!',
            html: `Eşleştirme oyununu tamamladınız.<br/>Toplam hata: <b>${mistakes}</b>`,
            icon: 'success',
            confirmButtonText: 'Bitir ve Kapat'
        }).then(() => {
            onClose();
        });
    };

    return (
        <Container fluid className="py-4 h-100 bg-body d-flex flex-column">
             <div className="d-flex justify-content-between align-items-center mb-4 px-md-4">
                 <div className="d-flex align-items-center gap-2">
                     <i className="bi bi-controller fs-4 text-success"></i>
                     <span className="fw-bold fs-5 text-body">Eşleştirme Modu</span>
                     <Badge bg="secondary" className="ms-2">Bölüm {chunkIndex + 1}/{totalChunks}</Badge>
                 </div>
                 <div className="d-flex align-items-center gap-3">
                     <div className="bg-danger bg-opacity-10 text-danger border border-danger border-opacity-50 rounded-pill px-3 py-1 fw-bold">
                         Hata: {mistakes}
                     </div>
                     <Button variant="outline-secondary" className="rounded-circle p-0" style={{ width: 36, height: 36 }} onClick={onClose}>
                         <i className="bi bi-x fs-5"></i>
                     </Button>
                 </div>
             </div>

             <Row className="flex-grow-1 align-items-center justify-content-center">
                 <Col lg={10} xl={8}>
                     <div className="d-flex flex-wrap gap-3 justify-content-center p-md-4">
                         {cards.map(card => {
                             const isSelected = selectedIds.includes(card.uniqueId);
                             const isMatched = matchedIds.includes(card.uniqueId);

                             const isPairSelected = selectedIds.length === 2;
                             let isCorrectPending = false;
                             let isWrongPending = false;

                             if (isPairSelected && isSelected) {
                                 const c1 = cards.find(c => c.uniqueId === selectedIds[0]);
                                 const c2 = cards.find(c => c.uniqueId === selectedIds[1]);
                                 if (c1 && c2 && c1.wordId === c2.wordId) {
                                     isCorrectPending = true;
                                 } else {
                                     isWrongPending = true;
                                 }
                             }

                             let containerClass = "d-flex align-items-center justify-content-center text-center p-3 fw-bold transition-all user-select-none ";
                             let extraStyle = {
                                 width: '45%',
                                 maxWidth: '220px',
                                 minHeight: '85px',
                                 borderRadius: '16px',
                                 cursor: isMatched ? 'default' : 'pointer',
                                 transform: 'scale(1)'
                             };

                             if (isMatched) {
                                 containerClass += "bg-success text-white pointer-events-none ";
                                 extraStyle.opacity = 0;
                                 extraStyle.transform = 'scale(0.8)';
                             } else if (isCorrectPending) {
                                 containerClass += "bg-success text-white shadow-lg border-0 ";
                                 extraStyle.transform = 'scale(1.05)';
                                 extraStyle.boxShadow = '0 0 20px rgba(25, 135, 84, 0.4)';
                                 extraStyle.zIndex = 10;
                             } else if (isWrongPending) {
                                 containerClass += "bg-danger text-white shadow-lg border-0 ";
                                 extraStyle.animation = 'shake 0.4s';
                                 extraStyle.zIndex = 10;
                             } else if (isSelected) {
                                 containerClass += "bg-primary text-white shadow-lg border-0 ";
                                 extraStyle.transform = 'scale(1.05)';
                                 extraStyle.zIndex = 10;
                             } else if (card.type === 'eng') {
                                 containerClass += "bg-body border border-primary border-opacity-25 text-body match-card-hover ";
                             } else {
                                 containerClass += "bg-body-tertiary border border-secondary border-opacity-25 text-body match-card-hover ";
                             }

                             return (
                                 <div
                                     key={card.uniqueId}
                                     className={containerClass}
                                     style={extraStyle}
                                     onClick={() => handleCardClick(card)}
                                     role="button"
                                 >
                                     <span style={{ fontSize: card.text.length > 20 ? '0.9rem' : '1.1rem', pointerEvents: 'none' }}>{card.text}</span>
                                 </div>
                             );
                         })}
                     </div>
                 </Col>
             </Row>
             <style>{`
                 @keyframes shake {
                     0%, 100% { transform: translateX(0); }
                     25% { transform: translateX(-6px); }
                     75% { transform: translateX(6px); }
                 }
                 .transition-all {
                     transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                 }
                 .match-card-hover:hover {
                     transform: translateY(-2px);
                     box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
                     border-color: rgba(var(--bs-primary-rgb), 0.5) !important;
                 }
                 .pointer-events-none {
                     pointer-events: none;
                 }
             `}</style>
        </Container>
    );
}
