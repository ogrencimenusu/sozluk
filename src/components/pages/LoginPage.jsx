import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Spinner } from 'react-bootstrap';
import { auth, googleProvider } from '../../firebase';
import { signInWithPopup } from 'firebase/auth';
import Swal from 'sweetalert2';

const LoginPage = ({ theme }) => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // Auth state change will be handled in App.jsx
    } catch (error) {
      console.error("Login Error:", error);
      Swal.fire({
        title: 'Giriş Başarısız',
        text: 'Google ile giriş yaparken bir hata oluştu. Lütfen tekrar deneyin.',
        icon: 'error',
        background: theme === 'dark' ? '#1e293b' : '#fff',
        color: theme === 'dark' ? '#f8fafc' : '#1e293b'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container d-flex align-items-center justify-content-center min-vh-100" style={{
      background: theme === 'dark' 
        ? 'radial-gradient(circle at top right, #1e293b, #0f172a)' 
        : 'radial-gradient(circle at top right, #f8fafc, #f1f5f9)',
      padding: '20px'
    }}>
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="border-0 shadow-lg rounded-5 glass-card overflow-hidden" style={{
              background: theme === 'dark' ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <Card.Body className="p-5 text-center">
                <div className="mb-4 d-inline-block p-4 rounded-circle bg-primary bg-opacity-10 shadow-sm">
                  <img src="/iconv2.png" alt="Sözlük Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                </div>
                
                <h2 className="fw-bold mb-2">Hoş Geldiniz</h2>
                <p className="text-muted mb-5">Kelime haznenizi geliştirmeye ve notlarınızı saklamaya hemen başlayın.</p>

                <div className="d-grid gap-3">
                  <Button 
                    variant="primary" 
                    size="lg" 
                    className="rounded-pill py-3 d-flex align-items-center justify-content-center gap-2 shadow-sm transition-all"
                    onClick={handleLogin}
                    disabled={loading}
                    style={{ fontWeight: '600' }}
                  >
                    {loading ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <i className="bi bi-google"></i>
                        Google ile Giriş Yap
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-5 pt-4 border-top border-secondary border-opacity-10">
                  <p className="text-muted small mb-0">Modern Sözlük v1.0</p>
                  <p className="text-muted" style={{ fontSize: '10px', opacity: 0.5 }}>Tüm verileriniz uçtan uca şifrelenir ve güvenle saklanır.</p>
                </div>
              </Card.Body>
            </Card>
            
            <p className="text-center mt-4 text-muted small px-4">
              Giriş yaparak kullanım koşullarını kabul etmiş olursunuz. Verileriniz güvenli bir şekilde saklanır.
            </p>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default LoginPage;
