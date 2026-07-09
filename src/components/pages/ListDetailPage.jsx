import React from 'react';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';

const ListDetailPage = ({
  listId,
  customLists,
  words,
  handleRemoveWordFromList,
  navigateTo,
  onWordClick,
  handleSpeak,
  dailyStats,
  stickyNotes = []
}) => {
  const list = customLists.find(l => l.id === listId);
  
  if (!list) {
    return (
      <Container className="text-center py-5">
        <div className="bg-body-tertiary p-5 rounded-4 border border-opacity-10">
          <i className="bi bi-exclamation-circle text-danger fs-1 mb-3 d-block"></i>
          <h4 className="fw-bold">Liste bulunamadı</h4>
          <p className="text-muted">Görünüşe göre bu liste silinmiş veya taşınmış olabilir.</p>
          <Button variant="primary" className="rounded-pill px-4" onClick={() => navigateTo('custom-lists')}>
            Listelerime Dön
          </Button>
        </div>
      </Container>
    );
  }

  const listWords = words.filter(w => list.wordIds?.includes(w.id));

  return (
    <div className="premium-list-detail-wrapper animate-fade-in py-2">
      {/* Premium Dashboard Header Banner */}
      <div 
        className="premium-header-banner mb-4 p-4 p-md-5 rounded-4 d-flex align-items-center justify-content-between text-white position-relative overflow-hidden" 
        style={{ 
          background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 100%)',
          boxShadow: '0 10px 30px rgba(14, 165, 233, 0.12)',
          borderRadius: '24px'
        }}
      >
        {/* Background glow overlay */}
        <div 
          className="position-absolute rounded-circle" 
          style={{ 
            width: '180px', 
            height: '180px', 
            background: 'rgba(255, 255, 255, 0.08)', 
            top: '-60px', 
            right: '-30px',
            filter: 'blur(35px)',
            pointerEvents: 'none'
          }}
        ></div>
        
        <div className="d-flex align-items-center gap-4">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" 
            style={{ 
              width: '56px', 
              height: '56px', 
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <i className="bi bi-folder2-open fs-3 text-white"></i>
          </div>
          <div>
            <h2 className="fw-extrabold mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.65rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
              {list.name}
            </h2>
            <p className="mb-0 text-white-50 small" style={{ fontSize: '0.88rem', opacity: 0.85 }}>
              Bu listede şu an {listWords.length} kelime bulunuyor.
            </p>
          </div>
        </div>
      </div>

      <Row className="g-3 g-md-4">
        {listWords.length === 0 ? (
          <Col xs={12}>
            <div className="text-center py-5 bg-body-tertiary rounded-4 border border-dashed border-opacity-25 mt-2">
              <div className="position-relative d-inline-block mb-3">
                <i className="bi bi-journal-text text-primary opacity-25" style={{ fontSize: '5rem' }}></i>
                <i className="bi bi-plus-circle-fill text-primary position-absolute bottom-0 end-0 fs-2"></i>
              </div>
              <h5 className="fw-bold">Bu liste henüz boş</h5>
              <p className="text-muted mb-4">Ana sayfadan kelimeleri seçip "Listeye Ekle" diyerek<br />bu grubu doldurmaya başlayabilirsiniz.</p>
              <Button variant="primary" className="rounded-pill px-4 py-2 fw-bold shadow-sm" onClick={() => navigateTo('home')}>
                <i className="bi bi-search me-2"></i> Kelime Bul & Ekle
              </Button>
            </div>
          </Col>
        ) : (
          listWords.map(word => (
            <Col key={word.id} xs={12} sm={6} md={4} lg={3}>
              <Card 
                className="h-100 word-card border-0 shadow-sm rounded-4 bg-body-tertiary transition-all hover-lift"
                onClick={() => onWordClick(word)}
                style={{ cursor: 'pointer', position: 'relative', overflow: 'visible' }}
              >
                {/* Sticky Note Indicator Dot */}
                {stickyNotes.some(n => n.wordId === word.id) && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#f59e0b',
                      borderRadius: '50%',
                      zIndex: 10,
                      boxShadow: '0 0 5px rgba(245, 158, 11, 0.5)',
                      border: '1.5px solid var(--bs-body-tertiary-bg)'
                    }}
                    title="Bu kelimeye ait notlar var"
                  />
                )}
                <Card.Body className="p-4 d-flex flex-column h-100">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="min-w-0 flex-grow-1 pe-2">
                      <h4 className="fw-bold mb-0 text-primary text-truncate" title={word.term}>{word.term}</h4>
                      {(() => {
                        if (!word.pronunciation) return null;
                        let displayPron = word.pronunciation;
                        if (displayPron.includes('(')) {
                          const match = displayPron.match(/^(.*?)\s*\(([^)]+)\)$/);
                          if (match) displayPron = match[2].trim();
                        } else {
                          displayPron = displayPron.replace(/^\/|\/$/g, '').trim();
                        }
                        return <span className="text-muted small">({displayPron})</span>;
                      })()}
                    </div>
                    <Button 
                      variant="link" 
                      className="p-1 text-danger opacity-25 hover-opacity-100 transition-all flex-shrink-0" 
                      onClick={(e) => { e.stopPropagation(); handleRemoveWordFromList(listId, word.id); }}
                      title="Listeden Çıkar"
                    >
                      <i className="bi bi-x-circle-fill fs-5"></i>
                    </Button>
                  </div>

                  <p className="text-body fw-medium mb-3 line-clamp-2" title={word.shortMeanings} style={{ fontSize: '0.95rem' }}>
                    {word.shortMeanings ? word.shortMeanings.split(',').map((m, idx) => `${idx + 1}. ${m.trim()}`).join(', ') : ''}
                  </p>

                  <div className="mt-auto pt-3 border-top border-opacity-10 d-flex justify-content-between align-items-center">
                    <div className="d-flex gap-2">
                      {word.learningStatus && (
                         <Badge 
                           bg={word.learningStatus === 'Öğrendi' ? 'success' : word.learningStatus === 'Öğreniyor' ? 'warning' : 'info'} 
                           text={word.learningStatus === 'Öğreniyor' ? 'dark' : 'light'}
                           className="rounded-pill px-2 py-1" 
                           style={{ fontSize: '0.65rem', fontWeight: 'bold' }}
                         >
                            {word.learningStatus}
                         </Badge>
                      )}
                    </div>
                    <Button 
                      variant="link" 
                      className="p-0 text-primary opacity-50 hover-opacity-100"
                      onClick={(e) => { e.stopPropagation(); handleSpeak(word.term, word); }}
                    >
                      <i className="bi bi-volume-up-fill fs-5"></i>
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))
        )}
      </Row>
    </div>
  );
};

export default ListDetailPage;
