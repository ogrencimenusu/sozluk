import React from 'react';
import { Row, Col, Card, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';

const SettingsPage = ({ theme, setTheme, viewMode, setViewMode, wordsPerPage, setWordsPerPage, navigateTo, dailyStats, authUser, onLogout, onFixRoots, onReparseAllWords }) => {
  const [isFixingRoots, setIsFixingRoots] = React.useState(false);
  const [fixProgress, setFixProgress] = React.useState(0);
  const [isReparsing, setIsReparsing] = React.useState(false);
  const [reparseProgress, setReparseProgress] = React.useState(0);

  const handleReparseLocal = async () => {
    const result = await Swal.fire({
      title: 'Kelimeleri Yeniden Ayrıştır',
      text: 'Tüm kelimeler ham şablon verileri (raw) kullanılarak baştan ayrıştırılacak ve veritabanı alanları güncellenecektir. Bu işlem kelime sayınıza göre biraz zaman alabilir. Devam etmek istiyor musunuz?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Evet, Başlat',
      cancelButtonText: 'İptal',
      background: theme === 'dark' ? '#1e293b' : '#fff',
      color: theme === 'dark' ? '#f8fafc' : '#1e293b'
    });

    if (result.isConfirmed) {
      setIsReparsing(true);
      setReparseProgress(0);
      try {
        const count = await onReparseAllWords((progress) => {
          setReparseProgress(progress);
        });
        await Swal.fire({
          title: 'Tamamlandı!',
          text: count > 0 ? `${count} kelime başarıyla yeniden ayrıştırıldı.` : 'Ayrıştırılacak ham verisi olan kelime bulunamadı.',
          icon: 'success',
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });
      } catch (error) {
        console.error('Reparse all failed:', error);
        Swal.fire({
          title: 'Hata!',
          text: 'Kelimeler yeniden ayrıştırılırken bir sorun oluştu.',
          icon: 'error',
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });
      } finally {
        setIsReparsing(false);
        setReparseProgress(0);
      }
    }
  };

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
      title: 'Önbelleği ve Verileri Temizle',
      text: 'Uygulamanın en güncel versiyonunu yüklemek ve tüm cihaz verilerini sıfırlamak için önbellek ve veritabanı temizlenecek, sayfa yenilenecektir. Senkronize edilmemiş yerel verileriniz silinecektir. Devam etmek istiyor musunuz?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Evet, Sıfırla ve Yenile',
      cancelButtonText: 'İptal',
      background: theme === 'dark' ? '#1e293b' : '#fff',
      color: theme === 'dark' ? '#f8fafc' : '#1e293b'
    });

    if (result.isConfirmed) {
      try {
        // 1. Clear application assets cache
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        // 2. Unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }
        // 3. Clear localStorage completely (Factory Reset / Clean Installation)
        localStorage.clear();

        await Swal.fire({
          title: 'Sıfırlandı!',
          text: 'Önbellek ve cihaz veritabanı temizlendi. Uygulama v3.0 olarak yeniden başlatılacak.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
        // Force completely uncached reload by appending a unique timestamp query parameter
        window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
      } catch (error) {
        console.error('Cache clearing failed:', error);
        Swal.fire({
          title: 'Hata!',
          text: 'Temizleme işlemi gerçekleştirilirken bir sorun oluştu.',
          icon: 'error',
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });
      }
    }
  };

  return (
    <div className="premium-settings-wrapper animate-fade-in py-2">
      {/* Premium Dashboard Header Banner */}
      <div 
        className="premium-header-banner mb-4 p-4 p-md-5 rounded-4 d-flex align-items-center gap-4 text-white position-relative overflow-hidden" 
        style={{ 
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          boxShadow: '0 10px 30px rgba(79, 70, 229, 0.12)',
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
          <i className="bi bi-gear-fill fs-3 text-white"></i>
        </div>
        <div>
          <h2 className="fw-extrabold mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.65rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Ayarlar
          </h2>
          <p className="mb-0 text-white-50 small" style={{ fontSize: '0.88rem', opacity: 0.85 }}>
            Uygulama tercihlerinizi ve sistem bakım işlemlerini buradan yönetin.
          </p>
        </div>
      </div>

      {/* Settings Grid Content */}
      <Row className="g-4">
        {/* Left Column: Account Info & Personalization */}
        <Col lg={6} className="d-flex flex-column gap-4">
          
          {/* Card 1: Account Info */}
          <Card className="border-0 premium-settings-card">
            <Card.Body className="p-4 p-md-5">
              <h5 className="fw-bold mb-4 text-secondary d-flex align-items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <i className="bi bi-person-badge-fill"></i>
                Hesap Bilgileri
              </h5>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-4">
                <div className="d-flex align-items-center gap-3">
                  <div 
                    className="rounded-circle d-flex align-items-center justify-content-center shadow-sm" 
                    style={{ 
                      width: '72px', 
                      height: '72px', 
                      minWidth: '72px',
                      background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                      padding: '3px'
                    }}
                  >
                    {authUser?.photoURL ? (
                      <img 
                        src={authUser.photoURL} 
                        alt="Profil" 
                        className="rounded-circle w-100 h-100" 
                        referrerPolicy="no-referrer"
                        style={{ objectFit: 'cover', background: '#fff' }} 
                      />
                    ) : (
                      <div className="rounded-circle w-100 h-100 bg-white d-flex align-items-center justify-content-center text-primary fw-bold fs-3">
                        {authUser?.displayName ? authUser.displayName.charAt(0).toUpperCase() : (authUser?.email ? authUser.email.charAt(0).toUpperCase() : 'U')}
                      </div>
                    )}
                  </div>
                  <div style={{ wordBreak: 'break-all' }}>
                    <h5 className="fw-bold mb-1 text-body" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {authUser?.displayName || 'Kullanıcı'}
                    </h5>
                    <p className="text-muted small mb-0">{authUser?.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline-danger"
                  className="rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm transition-all ms-auto ms-md-0 border-0"
                  onClick={onLogout}
                  style={{ 
                    fontSize: '14px', 
                    background: 'rgba(220, 53, 69, 0.05)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.background = 'rgba(220, 53, 69, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'rgba(220, 53, 69, 0.05)';
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i>
                  <span>Çıkış Yap</span>
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Card 2: Personalization */}
          <Card className="border-0 premium-settings-card">
            <Card.Body className="p-4 p-md-5">
              <h5 className="fw-bold mb-4 text-primary d-flex align-items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <i className="bi bi-palette-fill"></i>
                Kişiselleştirme
              </h5>
              <div className="d-flex flex-column mb-4 border-bottom border-opacity-10 pb-4 gap-2">
                <div>
                  <h6 className="fw-semibold mb-1" style={{ color: 'var(--bs-heading-color)' }}>Tema Seçimi</h6>
                  <p className="text-muted small mb-3">Uygulamanın genel renk temasını değiştirin.</p>
                </div>
                <div className="premium-settings-segment-group w-100" style={{ maxWidth: '360px' }}>
                  {['light', 'dark', 'system'].map(t => {
                    const labelMap = { light: 'Açık', dark: 'Karanlık', system: 'Sistem' };
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`premium-settings-segment-btn ${theme === t ? 'active' : ''}`}
                        onClick={() => setTheme(t)}
                      >
                        <i className={`bi bi-${t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'laptop'}-fill`}></i>
                        <span>{labelMap[t]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="d-flex flex-column gap-2">
                <div>
                  <h6 className="fw-semibold mb-1" style={{ color: 'var(--bs-heading-color)' }}>Sayfa Başına Kelime</h6>
                  <p className="text-muted small mb-3">Ana sayfada tek seferde kaç kelime yükleneceğini belirleyin.</p>
                </div>
                <div className="premium-settings-segment-group w-100" style={{ maxWidth: '360px' }}>
                  {[20, 50, 100, 200].map(count => (
                    <button
                      key={count}
                      type="button"
                      className={`premium-settings-segment-btn ${wordsPerPage === count ? 'active' : ''}`}
                      onClick={() => setWordsPerPage(count)}
                    >
                      <span>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card.Body>
          </Card>

        </Col>

        {/* Right Column: Maintenance & About */}
        <Col lg={6} className="d-flex flex-column gap-4">
          
          {/* Card 3: System and Maintenance */}
          <Card className="border-0 premium-settings-card">
            <Card.Body className="p-4 p-md-5">
              <h5 className="fw-bold mb-4 text-danger d-flex align-items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <i className="bi bi-tools"></i>
                Sistem ve Bakım
              </h5>
              <div className="d-flex flex-column mb-4 border-bottom border-opacity-10 pb-4 gap-2">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div className="flex-grow-1" style={{ maxWidth: '340px' }}>
                    <h6 className="fw-semibold mb-1" style={{ color: 'var(--bs-heading-color)' }}>Uygulama Önbelleği</h6>
                    <p className="text-muted small mb-0">Eğer uygulama güncellenmiyorsa önbelleği temizlemeyi deneyin.</p>
                  </div>
                  <Button 
                    variant="outline-danger" 
                    className="rounded-3 px-4 py-2 d-flex align-items-center justify-content-center gap-2 border-0 fw-semibold" 
                    onClick={handleClearCache}
                    style={{
                      background: 'rgba(220, 53, 69, 0.05)',
                      fontSize: '0.85rem',
                      height: '40px'
                    }}
                  >
                    <i className="bi bi-trash3-fill"></i>
                    <span>Cache Sil</span>
                  </Button>
                </div>
              </div>
              <div className="d-flex flex-column gap-3">
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div className="flex-grow-1" style={{ maxWidth: '340px' }}>
                      <h6 className="fw-semibold mb-1" style={{ color: 'var(--bs-heading-color)' }}>Kelime Köklerini Onar</h6>
                      <p className="text-muted small mb-0">Eski kelimelerin kök bilgilerini otomatik olarak hesapla ve güncelle.</p>
                    </div>
                    <div className="position-relative" style={{ minWidth: '130px' }}>
                      <Button 
                        variant={isFixingRoots ? "primary" : "outline-primary"}
                        className={`rounded-3 px-3 py-2 d-flex align-items-center justify-content-center gap-2 w-100 transition-all position-relative overflow-hidden ${isFixingRoots ? 'border-0' : 'border-0 fw-semibold'}`}
                        onClick={handleFixRootsLocal} 
                        disabled={isFixingRoots}
                        style={{ 
                          height: '40px',
                          background: isFixingRoots ? undefined : 'rgba(79, 70, 229, 0.05)',
                          color: isFixingRoots ? undefined : '#4f46e5',
                          fontSize: '0.85rem'
                        }}
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
                </div>
                
                <div className="d-flex flex-column gap-2 border-top border-opacity-10 pt-3">
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div className="flex-grow-1" style={{ maxWidth: '340px' }}>
                      <h6 className="fw-semibold mb-1" style={{ color: 'var(--bs-heading-color)' }}>Kelimeleri Yeniden Ayrıştır</h6>
                      <p className="text-muted small mb-0">Ham metin verilerinden kelime alanlarını yeniden parse edin.</p>
                    </div>
                    <div className="position-relative" style={{ minWidth: '130px' }}>
                      <Button 
                        variant={isReparsing ? "primary" : "outline-primary"}
                        className={`rounded-3 px-3 py-2 d-flex align-items-center justify-content-center gap-2 w-100 transition-all position-relative overflow-hidden ${isReparsing ? 'border-0' : 'border-0 fw-semibold'}`}
                        onClick={handleReparseLocal} 
                        disabled={isReparsing || isFixingRoots}
                        style={{ 
                          height: '40px',
                          background: isReparsing ? undefined : 'rgba(79, 70, 229, 0.05)',
                          color: isReparsing ? undefined : '#4f46e5',
                          fontSize: '0.85rem'
                        }}
                      >
                        {isReparsing ? (
                          <>
                            <div 
                              className="position-absolute top-0 start-0 h-100 bg-primary bg-opacity-25 transition-all" 
                              style={{ width: `${reparseProgress}%`, zIndex: 0 }}
                            ></div>
                            <span className="position-relative" style={{ zIndex: 1 }}>
                              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                              %{reparseProgress}
                            </span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-arrow-repeat"></i>
                            <span>Ayrıştır</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Card 4: About */}
          <Card className="border-0 premium-settings-card">
            <Card.Body className="p-4 p-md-5">
              <h5 className="fw-bold mb-4 text-secondary d-flex align-items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <i className="bi bi-info-circle-fill"></i>
                Hakkında
              </h5>
              <div 
                className="text-center py-4 rounded-4" 
                style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.012)' }}
              >
                <img src="/iconv2.png" alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '12px' }} />
                <h5 className="fw-bold mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sözlük Projesi</h5>
                <p className="text-muted small mb-3">Bireysel Kelime Öğrenme Asistanı</p>
                <div className="d-flex flex-wrap gap-2 align-items-center justify-content-center">
                  <div className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-bold" style={{ fontSize: '0.8rem' }}>Sürüm v3.0</div>
                  <div className="text-success small fw-medium ms-2">
                    <i className="bi bi-cloud-check-fill me-1"></i> Multi-Device Sync Aktif
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>

        </Col>
      </Row>
    </div>
  );
};

export default SettingsPage;
