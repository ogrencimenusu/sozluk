import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Spinner } from 'react-bootstrap';
import { auth, googleProvider } from '../../firebase';
import { signInWithPopup, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import Swal from 'sweetalert2';

const LoginPage = ({ theme: initialTheme }) => {
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || initialTheme || 'light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Force a theme class on body for standard components
    document.body.setAttribute('data-bs-theme', newTheme);
  };

  React.useEffect(() => {
    // Sync with initial theme or system preference if first visit
    if (!localStorage.getItem('theme')) {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) {
        setTheme('dark');
        document.body.setAttribute('data-bs-theme', 'dark');
      }
    }
  }, []);

  React.useEffect(() => {
    // Only run if Google script is loaded
    if (window.google && !loading) {
      const handleCredentialResponse = async (response) => {
        setLoading(true);
        try {
          const credential = GoogleAuthProvider.credential(response.credential);
          await signInWithCredential(auth, credential);
        } catch (error) {
          console.error("One Tap Error:", error);
          setLoading(false);
        }
      };

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: false
      });

      window.google.accounts.id.prompt();
    }
  }, [loading]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
      Swal.fire({
        title: 'Giriş Başarısız',
        text: 'Google ile giriş yaparken bir hata oluştu. Lütfen tekrar deneyin.',
        icon: 'error',
        background: theme === 'dark' ? '#0f172a' : '#fff',
        color: theme === 'dark' ? '#f8fafc' : '#0f172a'
      });
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className="login-wrapper min-vh-100 d-flex align-items-center justify-content-center"
      data-bs-theme={isDark ? 'dark' : 'light'}
      style={{
        background: isDark
          ? 'radial-gradient(circle at center, #111827 0%, #000000 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '2rem'
      }}
    >
      {/* Theme Toggle Button */}
      <Button
        variant={isDark ? "outline-light" : "outline-dark"}
        onClick={toggleTheme}
        className="position-absolute top-0 end-0 m-4 rounded-circle d-flex align-items-center justify-content-center p-0 shadow-sm"
        style={{ width: '45px', height: '45px', zIndex: 10, borderOpacity: 0.1 }}
      >
        <i className={`bi bi-${isDark ? 'sun-fill' : 'moon-stars-fill'}`}></i>
      </Button>

      {/* Decorative Blur Blobs for Dark Mode */}
      {isDark && (
        <>
          <div style={{
            position: 'absolute', top: '-10%', right: '-5%', width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
            filter: 'blur(100px)', zIndex: 0
          }} />
          <div style={{
            position: 'absolute', bottom: '-15%', left: '-5%', width: '600px', height: '600px',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
            filter: 'blur(100px)', zIndex: 0
          }} />
        </>
      )}

      <Container style={{ position: 'relative', zIndex: 1 }}>
        <Row className="justify-content-center">
          <Col md={8} lg={6} xl={5}>
            <Card
              className={`border-0 shadow-2xl overflow-hidden ${isDark ? 'bg-black' : ''}`}
              style={{
                borderRadius: '2.5rem',
                background: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: isDark
                  ? '0 25px 50px -12px rgba(0, 0, 0, 1)'
                  : '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
              }}
            >
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-5">
                  <div className="logo-container mb-4 d-inline-block position-relative">
                    {/* Glowing effect background for logo */}
                    <div className="position-absolute top-50 left-50 translate-middle" style={{
                      width: '160%', height: '160%',
                      background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
                      filter: 'blur(15px)', zIndex: -1
                    }} />
                    <div className={`p-4 rounded-circle shadow-sm d-flex align-items-center justify-content-center ${isDark ? 'bg-dark border border-secondary border-opacity-25' : 'bg-white'}`} style={{ width: '100px', height: '100px' }}>
                      <img src="/iconv2.png" alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                    </div>
                  </div>

                  <h1 className="fw-black mb-2" style={{
                    letterSpacing: '-1.5px',
                    fontSize: '2.5rem',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}>Hoş Geldiniz</h1>
                  <p style={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '1rem',
                    fontWeight: '400',
                    maxWidth: '300px',
                    margin: '0 auto'
                  }}>
                    Kelime haznenizi geliştirmeye ve notlarınızı saklamaya hemen başlayın.
                  </p>
                </div>

                <div className="d-grid mb-5">
                  <Button
                    variant="primary"
                    className="google-login-btn py-3 px-4 rounded-pill d-flex align-items-center justify-content-center gap-3 border-0 transition-all shadow-lg"
                    onClick={handleLogin}
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      minHeight: '64px'
                    }}
                  >
                    {loading ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <div className="bg-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                          <i className="bi bi-google text-primary" style={{ fontSize: '1.2rem' }}></i>
                        </div>
                        <span>Google ile Giriş Yap</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="text-center pt-4 border-top border-secondary border-opacity-10">
                  <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                    <span className="badge px-3 py-2 rounded-pill" style={{
                      background: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                      color: '#3b82f6',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>VERSION 2.1.1</span>
                    <span className="badge px-3 py-2 rounded-pill" style={{
                      background: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                      color: '#10b981',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>PRODUCTION READY</span>
                  </div>
                  <p style={{
                    fontSize: '0.75rem',
                    color: isDark ? '#475569' : '#94a3b8',
                    marginBottom: 0
                  }}>
                    Tüm verileriniz uçtan uca şifrelenir ve güvenle saklanır.
                  </p>
                </div>
              </Card.Body>
            </Card>

            <div className="text-center mt-4">
              <p className="small px-4" style={{
                color: isDark ? '#64748b' : '#94a3b8',
                lineHeight: '1.6'
              }}>
                Giriş yaparak <span className="text-decoration-underline cursor-pointer">Kullanım Koşullarını</span> kabul etmiş olursunuz.
              </p>
            </div>
          </Col>
        </Row>
      </Container>

      {/* Internal component styles */}
      <style>{`
        .bg-black { background-color: #000000 !important; }
        .google-login-btn:hover {
          transform: translateY(-2px);
          filter: brightness(110%);
          box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
        }
        .google-login-btn:active {
          transform: translateY(0);
        }
        .fw-black {
          font-weight: 900;
        }
        .cursor-pointer {
          cursor: pointer;
        }
        .shadow-2xl {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
