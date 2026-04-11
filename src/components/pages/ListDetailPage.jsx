import React from 'react';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';

const ListDetailPage = ({
  listId,
  customLists,
  words,
  handleRemoveWordFromList,
  setCurrentView,
  onWordClick,
  handleSpeak,
  dailyStats
}) => {
  const list = customLists.find(l => l.id === listId);
  
  if (!list) {
    return (
      <Container className="text-center py-5">
        <div className="bg-body-tertiary p-5 rounded-4 border border-opacity-10">
          <i className="bi bi-exclamation-circle text-danger fs-1 mb-3 d-block"></i>
          <h4 className="fw-bold">Liste bulunamadı</h4>
          <p className="text-muted">Görünüşe göre bu liste silinmiş veya taşınmış olabilir.</p>
          <Button variant="primary" className="rounded-pill px-4" onClick={() => setCurrentView('custom-lists')}>
            Listelerime Dön
          </Button>
        </div>
      </Container>
    );
  }

  const listWords = words.filter(w => list.wordIds?.includes(w.id));

  return (
    <Container fluid className="main-app-container animation-fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <PageHeader 
        title={list.name} 
        icon="bi-collection-play-fill" 
        onBack={() => setCurrentView('custom-lists')} 
        dailyStats={dailyStats}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <Badge bg="primary" className="bg-opacity-10 text-primary rounded-pill px-3 py-2 fw-bold shadow-sm d-none d-sm-block">
              {listWords.length} Kelime
            </Badge>
          </div>
        }
      />

      <div className="mb-4 d-sm-none text-center">
         <Badge bg="primary" className="bg-opacity-10 text-primary rounded-pill px-3 py-2 fw-bold shadow-sm">
            {listWords.length} Kelime
         </Badge>
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
              <Button variant="primary" className="rounded-pill px-4 py-2 fw-bold shadow-sm" onClick={() => setCurrentView('home')}>
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
                style={{ cursor: 'pointer' }}
              >
                <Card.Body className="p-4 d-flex flex-column h-100">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="min-w-0 flex-grow-1 pe-2">
                      <h4 className="fw-bold mb-0 text-primary text-truncate" title={word.term}>{word.term}</h4>
                      {word.pronunciation && <span className="text-muted small">/{word.pronunciation}/</span>}
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
                    {word.shortMeanings}
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
                      onClick={(e) => { e.stopPropagation(); handleSpeak(word.term); }}
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
    </Container>
  );
};

export default ListDetailPage;
