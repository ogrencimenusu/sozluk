
import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';
import Swal from 'sweetalert2';

const SettingsPage = ({ theme, setTheme, viewMode, setViewMode, wordsPerPage, setWordsPerPage, setCurrentView, dailyStats, authUser, onLogout, onFixRoots }) => {
  const [isFixingRoots, setIsFixingRoots] = React.useState(false);
  const [fixProgress, setFixProgress] = React.useState(0);

  const handleFixRootsLocal = async () => {
    const result = await Swal.fire({
      title: 'Kökleri Güncelle',
      text: 'Tüm kelimeler taranacak ve eksik kök bilgileri otomatik olarak güncellenecek. Bu işlem kelime sayınıza göre biraz zaman alabilir. Devam etmek istiyor musunuz?',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Evet, Başlat',
      cancelButtonText: 'İptal',
      background: theme === 'dark' ? '#1e293b' : '#fff',
      color: theme === 'dark' ? '#f8fafc' : '#1e293b'
    });

    if (result.isConfirmed) {
      setIsFixingRoots(true);
      setFixProgress(0);
      try {
        const count = await onFixRoots((progress) => {
          setFixProgress(progress);
        });
        await Swal.fire({
          title: 'Tamamlandı!',
          text: count > 0 ? `${count} kelimenin kök bilgisi güncellendi.` : 'Tüm kelimeler zaten güncel.',
          icon: 'success',
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });
      } catch (error) {
        console.error('Roots fix failed:', error);
        Swal.fire({
          title: 'Hata!',
          text: 'Kökler güncellenirken bir sorun oluştu.',
          icon: 'error',
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });
      } finally {
        setIsFixingRoots(false);
        setFixProgress(0);
      }
    }
  };

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
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }
        await Swal.fire({
          title: 'Başarılı!',
          text: 'Önbellek temizlendi. Uygulama v2.1.2 olarak yenilenecek.',
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
            {/* Hesap Bilgileri */}
            <Card className="border-0 shadow-sm rounded-4 mb-4 bg-body-tertiary">
              <Card.Body className="p-4 p-md-5">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-4">
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: '64px', height: '64px', minWidth: '64px' }}>
                      {authUser?.photoURL ? (
                        <img src={authUser.photoURL} alt="Profil" className="rounded-circle w-100 h-100" style={{ objectFit: 'cover' }} />
                      ) : (
                        <i className="bi bi-person-fill text-primary fs-2"></i>
                      )}
                    </div>
                    <div style={{ wordBreak: 'break-all' }}>
                      <h5 className="fw-bold mb-0 text-body">{authUser?.displayName || 'Kullanıcı'}</h5>
                      <p className="text-muted small mb-0">{authUser?.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline-danger"
                    className="rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm transition-all ms-auto ms-md-0"
                    onClick={onLogout}
                    style={{ fontSize: '14px' }}
                  >
                    <i className="bi bi-box-arrow-right"></i>
                    <span>Çıkış Yap</span>
                  </Button>
                </div>
              </Card.Body>
            </Card>

            {/* Kişiselleştirme */}
            <Card className="border-0 shadow-sm rounded-4 mb-4 bg-body-tertiary">
              <Card.Body className="p-4 p-md-5">
                <h5 className="fw-bold mb-4 text-primary d-flex align-items-center gap-2">
                  <i className="bi bi-palette-fill"></i>
                  Kişiselleştirme
                </h5>
                <div className="d-flex align-items-center justify-content-between mb-4 border-bottom border-opacity-10 pb-4">
                  <div>
                    <h6 className="fw-semibold mb-1">Tema Seçimi</h6>
                    <p className="text-muted small mb-0">Uygulamanın genel renk temasını değiştirin.</p>
                  </div>
                  <div className="d-flex gap-2">
                    {['light', 'dark', 'system'].map(t => (
                      <button
                        key={t}
                        className={`btn btn-sm rounded-pill px-3 transition-all ${theme === t ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-opacity-25'}`}
                        onClick={() => setTheme(t)}
                      >
                        <i className={`bi bi-${t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'laptop'}-fill me-1`}></i> {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between mt-4">
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
                  <p className="text-muted small mb-2 flex-grow-1">Bireysel Kelime Öğrenme Asistanı</p>
                  <div className="d-flex flex-column gap-2 align-items-center">
                    <div className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill">Sürüm v2.1.2</div>
                    <div className="text-success small fw-medium">
                      <i className="bi bi-cloud-check-fill me-1"></i> Multi-Device Sync Aktif
                    </div>
                  </div>
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
                <div className="d-flex align-items-center justify-content-between mb-4 border-bottom border-opacity-10 pb-4">
                  <div>
                    <h6 className="fw-semibold mb-1">Uygulama Önbelleği</h6>
                    <p className="text-muted small mb-0">Eğer uygulama güncellenmiyorsa önbelleği temizlemeyi deneyin.</p>
                  </div>
                  <Button variant="outline-danger" className="rounded-3 px-3 py-2 d-flex align-items-center gap-2" onClick={handleClearCache}>
                    <i className="bi bi-trash3-fill"></i>
                    <span>Temizle</span>
                  </Button>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <h6 className="fw-semibold mb-1">Kelime Köklerini Onar</h6>
                    <p className="text-muted small mb-0">Eski kelimelerin kök bilgilerini otomatik olarak hesapla ve güncelle.</p>
                  </div>
                  <div className="position-relative" style={{ minWidth: '140px' }}>
                    <Button 
                      variant={isFixingRoots ? "primary" : "outline-primary"}
                      className={`rounded-3 px-3 py-2 d-flex align-items-center justify-content-center gap-2 w-100 transition-all position-relative overflow-hidden ${isFixingRoots ? 'border-0' : ''}`}
                      onClick={handleFixRootsLocal} 
                      disabled={isFixingRoots}
                      style={{ height: '42px' }}
                    >
                      {isFixingRoots ? (
                        <>
                          <div 
                            className="position-absolute top-0 start-0 h-100 bg-primary bg-opacity-25 transition-all" 
                            style={{ width: `${fixProgress}%`, zIndex: 0 }}
                          ></div>
                          <span className="position-relative" style={{ zIndex: 1 }}>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            %{fixProgress}
                          </span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-magic"></i>
                          <span>Onar</span>
                        </>
                      )}
                    </Button>
                  </div>
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
