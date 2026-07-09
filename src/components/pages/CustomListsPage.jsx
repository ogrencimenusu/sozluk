import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, InputGroup, Badge } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';

const CustomListsPage = ({
  customLists,
  handleCreateList,
  handleUpdateList,
  handleDeleteList,
  handleMoveList,
  navigateTo,
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
    <div className="premium-lists-wrapper animate-fade-in py-2">
      {/* Premium Dashboard Header Banner */}
      <div 
        className="premium-header-banner mb-4 p-4 p-md-5 rounded-4 d-flex align-items-center gap-4 text-white position-relative overflow-hidden" 
        style={{ 
          background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
          boxShadow: '0 10px 30px rgba(13, 148, 136, 0.12)',
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
          <i className="bi bi-collection-play-fill fs-3 text-white"></i>
        </div>
        <div>
          <h2 className="fw-extrabold mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.65rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Özel Listelerim
          </h2>
          <p className="mb-0 text-white-50 small" style={{ fontSize: '0.88rem', opacity: 0.85 }}>
            Kelimelerinizi dilediğiniz gibi gruplandırın, çalışma listeleri oluşturun.
          </p>
        </div>
      </div>

      
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
            {(() => {
              const sortedLists = [...customLists].sort((a, b) => {
                const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(b.createdAt) - new Date(a.createdAt);
              });

              if (sortedLists.length === 0) {
                return (
                  <Col xs={12}>
                    <div className="text-center py-5 bg-body-tertiary rounded-4 border border-dashed border-opacity-25 mt-2">
                      <i className="bi bi-collection-play text-primary opacity-25 mb-3 d-block" style={{ fontSize: '4rem' }}></i>
                      <h5 className="fw-bold">Henüz hiç liste oluşturmadınız</h5>
                      <p className="text-muted">Kelimelerinizi anlamlı gruplara ayırmak için hemen bir liste oluşturun.</p>
                    </div>
                  </Col>
                );
              }

              return sortedLists.map((list, index) => (
                <Col key={list.id} xs={12} sm={6} md={4} lg={3}>
                  <Card 
                    className="h-100 border-0 shadow-sm rounded-4 bg-body-tertiary transition-all glass-card hover-lift"
                    onClick={() => {
                      if (editingListId !== list.id) {
                        setCurrentListId(list.id);
                        navigateTo('list-detail');
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
                            className={`p-1 text-primary transition-all ${index === 0 ? 'opacity-10' : 'opacity-50 hover-opacity-100'}`}
                            onClick={() => handleMoveList(list.id, 'up')}
                            disabled={index === 0}
                            title="Yukarı Taşı"
                          >
                            <i className="bi bi-chevron-up fs-5 fw-bold"></i>
                          </Button>
                          <Button 
                            variant="link" 
                            className={`p-1 text-primary transition-all ${index === sortedLists.length - 1 ? 'opacity-10' : 'opacity-50 hover-opacity-100'}`}
                            onClick={() => handleMoveList(list.id, 'down')}
                            disabled={index === sortedLists.length - 1}
                            title="Aşağı Taşı"
                          >
                            <i className="bi bi-chevron-down fs-5 fw-bold"></i>
                          </Button>
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
              ));
            })()}
          </Row>
    </div>
  );
};

export default CustomListsPage;
