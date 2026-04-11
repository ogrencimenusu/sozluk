import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Imports
imports = """
import PageHeader from './components/layout/PageHeader';
import AddWordPage from './components/pages/AddWordPage';
import StickyNotesPage from './components/pages/StickyNotesPage';
import SettingsPage from './components/pages/SettingsPage';
"""
if "import AddWordPage from" not in text:
    text = text.replace("import PageHeader from './components/layout/PageHeader';", imports.strip())

# 2. Add the renders for new pages after PracticeTest container.
# Currently the views look like this:
find_str = "        </Container>\n      )}\n\n      {/* MOBILE BOTTOM NAVIGATION BAR */}"
if find_str in text:
    new_pages = """
      {/* Add Word Page */}
      {currentView === 'add-word' && (
        <AddWordPage 
          words={words}
          templateType={templateType}
          setTemplateType={setTemplateType}
          templates={templates}
          setShowTemplateExampleModal={setShowTemplateExampleModal}
          learningStatus={learningStatus}
          setLearningStatus={setLearningStatus}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          termText={termText}
          setTermText={setTermText}
          parsedPreview={parsedPreview}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
          editingWordId={editingWordId}
          theme={theme}
          toggleTheme={toggleTheme}
          setCurrentView={setCurrentView}
          closeModal={closeModal}
        />
      )}

      {/* Sticky Notes Page */}
      {currentView === 'sticky-notes' && (
        <StickyNotesPage
          stickyNotes={stickyNotes}
          manualNoteText={manualNoteText}
          setManualNoteText={setManualNoteText}
          handleAddNote={handleAddNote}
          handleDeleteNote={handleDeleteNote}
          editingNoteId={editingNoteId}
          setEditingNoteId={setEditingNoteId}
          inlineEditingText={inlineEditingText}
          setInlineEditingText={setInlineEditingText}
          handleUpdateNote={handleUpdateNote}
          theme={theme}
          toggleTheme={toggleTheme}
          setCurrentView={setCurrentView}
        />
      )}

      {/* Settings Page */}
      {currentView === 'settings' && (
        <SettingsPage 
          theme={theme}
          toggleTheme={toggleTheme}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      )}
"""
    text = text.replace("      )}\n\n      {/* MOBILE BOTTOM NAVIGATION BAR */}", "      )}\n" + new_pages + "\n      {/* MOBILE BOTTOM NAVIGATION BAR */}")

# 3. Clean up the Modals for "Yeni Kelime Ekle" and "Sticky Notlarım".
# Yeni Kelime Modal opens with `<Modal show={isModalOpen}` and ends with `</Modal>`
# Sticky Notes Modal opens with `<Modal\n        show={showStickyNotesModal}`
# I will just write regex to remove them.

# Remove New Word Modal
modal1_pattern = re.compile(r"\{\/\* NEW WORD MODAL \*\/\}\n\s*<Modal show=\{isModalOpen\}[\s\S]*?</Modal>\n", re.MULTILINE)
text = re.sub(modal1_pattern, "", text)

# Remove Sticky Notes Modal
modal2_pattern = re.compile(r"\{\/\* STICKY NOTES MODAL \*\/\}\n\s*<Modal\n\s*show=\{showStickyNotesModal\}[\s\S]*?</Modal>\n", re.MULTILINE)
text = re.sub(modal2_pattern, "", text)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

