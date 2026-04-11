import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# First, close the wrapper if not closed.
# The container ends with:
#               )}
#             </main>
#           
#         
#       </Container>
# 
#       {/* MOBILE BOTTOM NAVIGATION BAR */}

idx1 = text.find('</Container>\n\n      {/* MOBILE BOTTOM NAVIGATION BAR */}')
if idx1 != -1:
    # It wasn't closed.
    text = text[:idx1] + "</Container>\n      )}\n\n" + text[idx1 + 14:]

# Now, we need to append the new views before {/* MOBILE BOTTOM NAVIGATION BAR */}
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

if "currentView === 'add-word'" not in text:
    text = text.replace("{/* MOBILE BOTTOM NAVIGATION BAR */}", new_pages + "\n      {/* MOBILE BOTTOM NAVIGATION BAR */}")


with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

