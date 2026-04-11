import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

find_str = "{/* MOBILE BOTTOM NAVIGATION BAR */}"
idx = text.find(find_str)
end_idx = text.find("        </div>", idx)

if idx != -1 and end_idx != -1:
    new_nav = """{/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="mobile-bottom-nav d-md-none">
          <button
            className={`mobile-nav-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            <i className={currentView === 'home' ? "bi bi-house-door-fill text-primary" : "bi bi-house-door"}></i>
            <span className={currentView === 'home' ? "text-primary fw-bold" : ""}>Ana Sayfa</span>
          </button>
          
          <button 
            className={`mobile-nav-item ${currentView === 'practice-test' ? 'active' : ''}`} 
            onClick={() => setCurrentView('practice-test')}
          >
            <i className={currentView === 'practice-test' ? "bi bi-controller text-primary" : "bi bi-controller"}></i>
            <span className={currentView === 'practice-test' ? "text-primary fw-bold" : ""}>Test Çöz</span>
          </button>

          <button 
            className="mobile-nav-center-btn" 
            onClick={() => {
              setCurrentView('add-word');
              setEditingWordId(null);
              setTermText('');
            }}
          >
            <i className="bi bi-plus-lg"></i>
          </button>

          <button 
            className={`mobile-nav-item position-relative ${currentView === 'sticky-notes' ? 'active' : ''}`} 
            onClick={() => setCurrentView('sticky-notes')}
          >
            <i className={currentView === 'sticky-notes' ? "bi bi-pin-angle-fill text-primary" : "bi bi-pin-angle"} style={{ color: currentView === 'sticky-notes' ? '' : '#f59e0b' }}></i>
            <span className={currentView === 'sticky-notes' ? "text-primary fw-bold" : ""}>Notlarım</span>
            {stickyNotes.length > 0 && (
              <span
                className="position-absolute top-0 end-0 text-white fw-bold d-flex align-items-center justify-content-center"
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', fontSize: '9px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  transform: 'translate(2px, 0px)'
                }}
              >
                {stickyNotes.length > 99 ? '99+' : stickyNotes.length}
              </span>
            )}
          </button>

          <button 
            className={`mobile-nav-item ${currentView === 'settings' ? 'active' : ''}`} 
            onClick={() => setCurrentView('settings')}
          >
            <i className={currentView === 'settings' ? "bi bi-gear-fill text-primary" : "bi bi-gear"}></i>
            <span className={currentView === 'settings' ? "text-primary fw-bold" : ""}>Ayarlar</span>
          </button>
        </div>"""
    
    text = text[:idx] + new_nav + text[end_idx + 14:]
    
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

