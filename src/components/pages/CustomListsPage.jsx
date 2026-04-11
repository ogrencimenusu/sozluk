import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, InputGroup, Badge } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';

const CustomListsPage = ({
  customLists,
  handleCreateList,
  handleUpdateList,
  handleDeleteList,
  setCurrentView,
  setCurrentListId,
  dailyStats
}) => {
  const [newListName, setNewListName] = useState('');
  const [editingListId, setEditingListId] = useState(null);
  const [editName, setEditName] = useState('');

  const onCreate = async () => {
    if (!newListName.trim()) return;
    await handleCreateList(newListName);
    setNewListName('');
  };

  const onUpdate = async (id) => {
    if (!editName.trim()) return;
    await handleUpdateList(id, editName);
    setEditingListId(null);
  };

  return (
    <Container fluid className="main-app-container animation-fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <PageHeader 
        title="Özel Listelerim" 
        icon="bi-collection-play-fill" 
        onBack={() => setCurrentView('home')} 
        dailyStats={dailyStats} 
      />

      <Row className="justify-content-center mx-0">
        <Col md={10} lg={8}>
          {/* Yeni Liste Oluşturma */}
          <Card className="border-0 shadow-sm rounded-4 mb-4 bg-body-tertiary">
            <Card.Body className="p-4">
              <h6 className="fw-bold mb-3 text-primary d-flex align-items-center gap-2">
                <i className="bi bi-plus-circle-fill"></i> Yeni Liste Oluştur
              </h6>
              <div className="d-flex flex-column flex-sm-row gap-3">
                <Form.Control
                  type="text"
                  placeholder="Liste adı (örn: Mülakat Kelimeleri, Seyahat...)"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); }}
                  className="bg-body-secondary border-0 shadow-none px-4 py-3 rounded-pill flex-grow-1"
                />
                <Button 
                  variant="primary" 
                  className="rounded-pill px-4 py-2 fw-semibold shadow-sm animate-pulse-on-hover"
                  onClick={onCreate}
                  disabled={!newListName.trim()}
                >
                  <i className="bi bi-plus-lg me-1"></i> Oluştur
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Liste Görünümü */}
          <Row className="g-4">
            {customLists.length === 0 ? (
              <Col xs={12}>
                <div className="text-center py-5 bg-body-tertiary rounded-4 border border-dashed border-opacity-25 mt-2">
                  <i className="bi bi-collection-play text-primary opacity-25 mb-3 d-block" style={{ fontSize: '4rem' }}></i>
                  <h5 className="fw-bold">Henüz hiç liste oluşturmadınız</h5>
                  <p className="text-muted">Kelimelerinizi anlamlı gruplara ayırmak için hemen bir liste oluşturun.</p>
                </div>
              </Col>
            ) : (
              [...customLists].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map((list) => (
                <Col key={list.id} sm={6}>
                  <Card 
                    className="h-100 border-0 shadow-sm rounded-4 bg-body-tertiary transition-all glass-card hover-lift"
                    onClick={() => {
                      if (editingListId !== list.id) {
                        setCurrentListId(list.id);
                        setCurrentView('list-detail');
                      }
                    }}
                    style={{ cursor: 'pointer', overflow: 'hidden' }}
                  >
                    <Card.Body className="p-4 d-flex flex-column h-100">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="p-3 bg-primary bg-opacity-10 rounded-4 text-primary shadow-sm">
                          <i className="bi bi-collection-play-fill fs-4"></i>
                        </div>
                        <div className="d-flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button 
                            variant="link" 
                            className="p-1 text-muted opacity-50 hover-opacity-100 transition-all"
                            onClick={() => { setEditingListId(list.id); setEditName(list.name); }}
                            title="Düzenle"
                          >
                            <i className="bi bi-pencil-square fs-5"></i>
                          </Button>
                          <Button 
                            variant="link" 
                            className="p-1 text-danger opacity-50 hover-opacity-100 transition-all"
                            onClick={() => handleDeleteList(list.id)}
                            title="Sil"
                          >
                            <i className="bi bi-trash fs-5"></i>
                          </Button>
                        </div>
                      </div>

                      {editingListId === list.id ? (
                        <div className="mb-3" onClick={e => e.stopPropagation()}>
                          <InputGroup className="bg-body-secondary rounded-pill p-1 border border-primary border-opacity-25">
                            <Form.Control
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="bg-transparent border-0 shadow-none ps-3 py-2"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') onUpdate(list.id); if (e.key === 'Escape') setEditingListId(null); }}
                            />
                            <Button variant="primary" className="rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }} onClick={() => onUpdate(list.id)}>
                              <i className="bi bi-check-lg"></i>
                            </Button>
                            <Button variant="outline-secondary" className="rounded-circle p-0 d-flex align-items-center justify-content-center border-0" style={{ width: '36px', height: '36px' }} onClick={() => setEditingListId(null)}>
                              <i className="bi bi-x-lg"></i>
                            </Button>
                          </InputGroup>
                        </div>
                      ) : (
                        <h5 className="fw-bold mb-1 text-truncate pe-2" title={list.name}>{list.name}</h5>
                      )}
                      
                      <p className="text-muted small mb-3">
                         {list.wordIds?.length || 0} kelime içeriyor
                      </p>

                      <div className="mt-auto pt-3 d-flex align-items-center justify-content-between border-top border-opacity-10">
                        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 fw-bold" style={{ fontSize: '0.75rem' }}>
                          <i className="bi bi-eye me-1"></i> Görüntüle
                        </span>
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-calendar3 me-1"></i>
                          {new Date(list.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))
            )}
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default CustomListsPage;
