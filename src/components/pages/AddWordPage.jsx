import React, { useMemo, useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Spinner } from 'react-bootstrap';
import PageHeader from '../layout/PageHeader';

const AddWordPage = ({
  words,
  templateType,
  setTemplateType,
  templates,
  setShowTemplateExampleModal,
  learningStatus,
  setLearningStatus,
  selectedDate,
  setSelectedDate,
  termText,
  setTermText,
  parsedPreview,
  isSubmitting,
  handleSubmit,
  editingWordId,
  theme,
  toggleTheme,
  setCurrentView,
  closeModal,
  onWordClick,
  dailyStats
}) => {
  const [expandedDates, setExpandedDates] = useState([]);

  const handleToggleExpand = (dateLabel) => {
    setExpandedDates(prev => 
      prev.includes(dateLabel) 
        ? prev.filter(d => d !== dateLabel) 
        : [...prev, dateLabel]
    );
  };

  const groupedWords = useMemo(() => {
    const groups = {};
    const sortedWords = [...words].sort((a, b) => {
      const aVal = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const bVal = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      return bVal - aVal;
    });

    sortedWords.forEach(word => {
      const dateObj = word.createdAt ? (word.createdAt.toDate ? word.createdAt.toDate() : new Date(word.createdAt)) : new Date();
      // Format to localized date (e.g., "15 Nisan 2026")
      const opts = { day: 'numeric', month: 'long', year: 'numeric' };
      const dateStr = dateObj.toLocaleDateString('tr-TR', opts);
      
      const today = new Date().toLocaleDateString('tr-TR', opts);
      const yesterdayObj = new Date();
      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
      const yesterday = yesterdayObj.toLocaleDateString('tr-TR', opts);

      let key = dateStr;
      if (dateStr === today) key = "Bugün";
      else if (dateStr === yesterday) key = "Dün";

      if (!groups[key]) groups[key] = [];
      groups[key].push(word);
    });

    return groups;
  }, [words]);

  return (
    <Container fluid className="main-app-container animation-fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <PageHeader 
        title={editingWordId ? "Kelime Düzenle" : "Kelime Ekle"} 
        icon="bi-plus-lg" 
        onBack={closeModal} 
        dailyStats={dailyStats} 
      />

      <Row className="g-4">
        {/* Sol Kolon: Son Eklenen Kelimeler - Desktop'ta solda, Mobil'de altta (order-2) */}
        <Col xs={12} md={5} lg={4} className="order-2 order-md-1">
          <Card className="border-0 shadow-sm rounded-4 h-100 bg-body-tertiary">
            <Card.Header className="bg-transparent border-0 pt-4 pb-2 px-4">
              <h5 className="fw-bold m-0 d-flex align-items-center gap-2 text-primary">
                <i className="bi bi-clock-history"></i> Son Eklenenler
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              {Object.keys(groupedWords).length === 0 ? (
                <div className="text-muted text-center p-4">Henüz kelime eklenmemiş.</div>
              ) : (
                <div className="d-flex flex-column gap-3 p-4 pt-1">
                  {Object.entries(groupedWords).map(([dateLabel, items], idx) => (
                    <div key={idx}>
                      <div className="small fw-bold text-muted mb-2 ps-2" style={{ letterSpacing: '0.5px' }}>{dateLabel}</div>
                      <div className="d-flex flex-column gap-2">
                        {items.slice(0, expandedDates.includes(dateLabel) ? items.length : 4).map((w, i) => (
                          <div 
                            key={w.id} 
                            className="bg-body shadow-sm p-3 rounded-4 d-flex align-items-center gap-3 interactive-card" 
                            style={{ cursor: 'pointer' }}
                            onClick={() => onWordClick && onWordClick(w)}
                          >
                            <div className="text-primary fw-bold fs-6 flex-grow-1">{i + 1}. {w.term}</div>
                            {w.shortMeanings && <span className="badge bg-secondary bg-opacity-25 text-body rounded-pill text-truncate" style={{ maxWidth: '100px' }}>{w.shortMeanings}</span>}
                          </div>
                        ))}
                        {items.length > 4 && (
                          <div className="text-center mt-1">
                            <span 
                              className="text-primary small fw-medium" 
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleToggleExpand(dateLabel)}
                            >
                              {expandedDates.includes(dateLabel) ? (
                                <><i className="bi bi-chevron-up"></i> Daha az göster</>
                              ) : (
                                <>({items.length - 4} adet kelime daha) <i className="bi bi-chevron-down"></i></>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Sağ Kolon: Ekleme Formu - Desktop'ta sağda, Mobil'de üstte (order-1) */}
        <Col xs={12} md={7} lg={8} className="order-1 order-md-2">
          <Card className="border-0 shadow-sm rounded-4 h-100 bg-body-tertiary">
            <Form onSubmit={handleSubmit} className="d-flex flex-column h-100">
              <Card.Body className="p-4 p-md-5 flex-grow-1">
                <Form.Group className="mb-4 d-flex flex-column flex-sm-row gap-3">
                  <div className="flex-grow-1">
                    <Form.Label className="mb-1 fw-semibold text-muted">Şablon Tipi</Form.Label>
                    <Form.Select
                      value={templateType}
                      onChange={e => setTemplateType(e.target.value)}
                      className="bg-body-secondary border-0 px-3 py-2 rounded-3 shadow-none w-100"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="flex-shrink-0 d-flex align-items-end">
                    <Button
                      variant="outline-info"
                      className="mb-0 rounded-3"
                      onClick={() => setShowTemplateExampleModal(true)}
                      title="Şablon Örneğini Gör"
                    >
                      <i className="bi bi-eye"></i> Örnek
                    </Button>
                  </div>
                </Form.Group>

                <Form.Group className="mb-4 d-flex flex-column flex-sm-row gap-3">
                  <div className="flex-grow-1">
                    <Form.Label className="mb-1 fw-semibold text-muted">Öğrenme Durumu</Form.Label>
                    <Form.Select
                      value={learningStatus}
                      onChange={e => setLearningStatus(e.target.value)}
                      className="bg-body-secondary border-0 px-3 py-2 rounded-3 shadow-none w-100"
                    >
                      <option value="Yeni">Yeni</option>
                      <option value="Öğreniyor">Öğreniyor</option>
                      <option value="Öğrendi">Öğrendi</option>
                    </Form.Select>
                  </div>
                  <div className="flex-grow-1">
                    <Form.Label className="mb-1 fw-semibold text-muted">Eklenme Tarihi</Form.Label>
                    <Form.Control
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="bg-body-secondary border-0 px-3 py-2 rounded-3 shadow-none w-100"
                    />
                  </div>
                </Form.Group>

                <Form.Group className="mb-2">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <Form.Label className="fw-semibold text-muted mb-0">Şablonu Buraya Yapıştırın</Form.Label>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="rounded-pill px-3 shadow-sm fw-medium d-flex align-items-center gap-1 bg-body"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setTermText(prev => prev ? prev + '\n' + text : text);
                        } catch (err) {
                          console.error('Panodan okuma başarısız: ', err);
                        }
                      }}
                    >
                      <i className="bi bi-clipboard"></i> Yapıştır
                    </Button>
                  </div>
                  <Form.Control
                    as="textarea"
                    rows={12}
                    value={termText}
                    onChange={e => setTermText(e.target.value)}
                    required
                    placeholder="Kelime: compromise&#10;Türkçe Okunuşu: kom-pro-mayz..."
                    className="font-monospace bg-body-secondary border-0 p-4 rounded-4 shadow-none fs-6"
                    style={{ resize: 'vertical' }}
                  />
                </Form.Group>
                
                <div className="d-flex justify-content-end gap-3 mb-4">
                  <Button variant="secondary" onClick={closeModal} className="rounded-pill px-4 bg-body-secondary text-body border-0 shadow-sm fw-medium">
                    Vazgeç
                  </Button>
                  <Button variant="primary" type="submit" disabled={isSubmitting} className="rounded-pill px-5 fw-bold shadow-sm d-flex align-items-center gap-2">
                    {isSubmitting ? (
                      <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> {editingWordId ? 'Güncelleniyor...' : 'Kaydediliyor...'}</>
                    ) : (
                      <><i className="bi bi-check2-all fs-5"></i> {editingWordId ? 'Güncelle' : 'Kaydet'}</>
                    )}
                  </Button>
                </div>

                {parsedPreview.length > 0 && (
                  <div className="mt-4">
                    <h6 className="fw-bold mb-3 text-primary d-flex align-items-center gap-2">
                      <i className="bi bi-robot"></i> Sistem Çıktısı ({parsedPreview.length} kelime)
                    </h6>
                    <div className="p-4">
                      {parsedPreview.map((item, idx) => (
                        <div key={idx} className="bg-body p-3 rounded-4 shadow-sm border border-opacity-10">
                          <div className="fw-bold text-primary mb-2 border-bottom border-opacity-10 pb-2">
                            {item.term || 'Bilinmeyen Kelime'}
                          </div>
                          <div className="d-flex flex-wrap gap-2" style={{ fontSize: '0.85em' }}>
                            {/* Check badges visually */}
                            {['pronunciation', 'shortMeanings', 'generalDefinition', 'meanings', 'grammar', 'synonyms', 'collocations', 'idioms', 'wordFamily', 'tips'].map(key => {
                              const hasValue = Array.isArray(item[key]) ? item[key].length > 0 : !!item[key];
                              if (!hasValue) return null;
                              return (
                                <span key={key} className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-1">
                                  {key.replace(/([A-Z])/g, ' $1').trim()} <i className="bi bi-check-lg ms-1"></i>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card.Body>


            </Form>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AddWordPage;
