import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';
import Swal from 'sweetalert2';

const SettingsPage = ({ theme, toggleTheme, viewMode, setViewMode, wordsPerPage, setWordsPerPage, setCurrentView, dailyStats }) => {
  const handleClearCache = async () => {
    const result = await Swal.fire({
      title: 'Önbelleği Temizle',
      text: 'Uygulamanın en güncel versiyonunu yüklemek için önbellek temizlenecek ve sayfa yenilenecek. Devam etmek istiyor musunuz?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Evet, Temizle ve Yenile',
      cancelButtonText: 'İptal',
      background: theme === 'dark' ? '#1e293b' : '#fff',
      color: theme === 'dark' ? '#f8fafc' : '#1e293b'
    });

    if (result.isConfirmed) {
      try {
        // Clear Cache API
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        // Unregister Service Workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }

        // Clear Local Storage (selective) - keep auth/settings if possible, or just force reload
        // For now, let's keep it safe and just do cache/SW + reload

        await Swal.fire({
          title: 'Başarılı!',
          text: 'Önbellek temizlendi. Sayfa şimdi yenilenecek.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });

        window.location.reload(true);
      } catch (error) {
        console.error('Cache clearing failed:', error);
        Swal.fire({
          title: 'Hata!',
          text: 'Önbellek temizlenirken bir sorun oluştu.',
          icon: 'error',
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });
      }
    }
  };

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

                <div className="d-flex align-items-center justify-content-between mb-4">
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

                <div className="d-flex align-items-center justify-content-between mt-4 border-top border-opacity-10 pt-4">
                  <div>
                    <h6 className="fw-semibold mb-1">Sayfa Başına Kelime</h6>
                    <p className="text-muted small mb-0">Ana sayfada tek seferde kaç kelime yükleneceğini belirleyin.</p>
                  </div>
                  <div className="d-flex gap-2">
                    {[20, 50, 100, 200].map(count => (
                      <button
                        key={count}
                        className={`btn btn-sm rounded-pill px-3 transition-all ${wordsPerPage === count ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-opacity-25'}`}
                        onClick={() => setWordsPerPage(count)}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

              </Card.Body>
            </Card>

            {/* Hakkında */}
            <Card className="border-0 shadow-sm rounded-4 bg-body-tertiary mb-4">
              <Card.Body className="p-4 p-md-5">
                <h5 className="fw-bold mb-4 text-secondary d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle-fill"></i>
                  Hakkında
                </h5>
                <div className="text-center py-4 bg-body-secondary rounded-4">
                  <img src="/iconv2.png" alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '12px' }} />
                  <h5 className="fw-bold mb-1">Sözlük Projesi</h5>
                  <p className="text-muted small mb-0 flex-grow-1">Bireysel Kelime Öğrenme Asistanı</p>
                  <div className="mt-3 badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill">Sürüm v3.3</div>
                </div>
              </Card.Body>
            </Card>

            {/* Sistem ve Bakım */}
            <Card className="border-0 shadow-sm rounded-4 bg-body-tertiary">
              <Card.Body className="p-4 p-md-5">
                <h5 className="fw-bold mb-4 text-danger d-flex align-items-center gap-2">
                  <i className="bi bi-tools"></i>
                  Sistem ve Bakım
                </h5>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <h6 className="fw-semibold mb-1">Uygulama Önbelleği</h6>
                    <p className="text-muted small mb-0">Eğer uygulama güncellenmiyorsa önbelleği temizlemeyi deneyin.</p>
                  </div>
                  <Button
                    variant="outline-danger"
                    className="rounded-3 px-3 py-2 d-flex align-items-center gap-2"
                    onClick={handleClearCache}
                  >
                    <i className="bi bi-trash3-fill"></i>
                    <span>Temizle</span>
                  </Button>
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
