import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';

const SettingsPage = ({ theme, toggleTheme, viewMode, setViewMode, setCurrentView, dailyStats }) => {
  return (
    <div className="main-app-container animation-fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <PageHeader 
        title="Ayarlar" 
        icon="bi-gear-fill" 
        onBack={() => setCurrentView('home')} 
        dailyStats={dailyStats} 
      />
      <Container className="py-4 px-2 px-md-4" style={{ maxWidth: "100%", overflowX: "hidden" }}>
        <Row className="justify-content-center">
          <Col md={10} lg={8}>
            {/* Görünüm Ayarları */}
            <Card className="border-0 shadow-sm rounded-4 mb-4 bg-body-tertiary">
              <Card.Body className="p-4 p-md-5">
                <h5 className="fw-bold mb-4 text-primary d-flex align-items-center gap-2">
                  <i className="bi bi-palette-fill"></i>
                  Kişiselleştirme
                </h5>
                
                <div className="d-flex align-items-center justify-content-between mb-4 border-bottom border-opacity-10 pb-4">
                  <div>
                    <h6 className="fw-semibold mb-1">Tema Seçimi</h6>
                    <p className="text-muted small mb-0">Uygulamanın genel renk temasını değiştirin (Açık/Koyu).</p>
                  </div>
                  <div 
                    className="d-flex align-items-center justify-content-between p-1 rounded-pill" 
                    style={{ backgroundColor: theme === 'light' ? '#e2e8f0' : '#1e293b', width: '80px', cursor: 'pointer', transition: 'all 0.3s ease' }}
                    onClick={toggleTheme}
                  >
                    <div className={`rounded-circle d-flex align-items-center justify-content-center transition-all ${theme === 'light' ? 'bg-white shadow-sm' : 'text-muted'}`} style={{ width: '36px', height: '36px' }}>
                      <i className="bi bi-sun-fill" style={{ color: theme === 'light' ? '#f59e0b' : 'inherit' }}></i>
                    </div>
                    <div className={`rounded-circle d-flex align-items-center justify-content-center transition-all ${theme === 'dark' ? 'bg-dark bg-opacity-50 text-white shadow-sm' : 'text-muted'}`} style={{ width: '36px', height: '36px' }}>
                      <i className="bi bi-moon-fill" style={{ color: theme === 'dark' ? '#fbbf24' : 'inherit' }}></i>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <h6 className="fw-semibold mb-1">Varsayılan Görünüm</h6>
                    <p className="text-muted small mb-0">Kelime listesinin ana sayfadaki varsayılan dizilimi.</p>
                  </div>
                  <div className="d-flex gap-2">
                    <button 
                      className={`btn rounded-3 d-flex flex-column align-items-center justify-content-center p-3 transition-all ${viewMode === 'grid' ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-opacity-25'}`}
                      style={{ width: '80px' }}
                      onClick={() => setViewMode('grid')}
                    >
                      <i className="bi bi-grid-3x3-gap-fill mb-1 fs-5"></i>
                      <span style={{ fontSize: '11px', fontWeight: '500' }}>Klasik</span>
                    </button>
                    <button 
                      className={`btn rounded-3 d-flex flex-column align-items-center justify-content-center p-3 transition-all ${viewMode === 'detailed' ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-opacity-25'}`}
                      style={{ width: '80px' }}
                      onClick={() => setViewMode('detailed')}
                    >
                      <i className="bi bi-view-list mb-1 fs-5"></i>
                      <span style={{ fontSize: '11px', fontWeight: '500' }}>Detaylı</span>
                    </button>
                  </div>
                </div>

              </Card.Body>
            </Card>

            {/* Hakkında */}
            <Card className="border-0 shadow-sm rounded-4 bg-body-tertiary">
              <Card.Body className="p-4 p-md-5">
                <h5 className="fw-bold mb-4 text-secondary d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle-fill"></i>
                  Hakkında
                </h5>
                <div className="text-center py-4 bg-body-secondary rounded-4">
                  <img src="/iconv2.png" alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '12px' }} />
                  <h5 className="fw-bold mb-1">Sözlük Projesi</h5>
                  <p className="text-muted small mb-0 flex-grow-1">Bireysel Kelime Öğrenme Asistanı</p>
                  <div className="mt-3 badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill">Sürüm 2.0.0</div>
                </div>
              </Card.Body>
            </Card>

          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default SettingsPage;
