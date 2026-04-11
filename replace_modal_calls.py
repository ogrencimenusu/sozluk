import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace setShowStickyNotesModal(true) with setCurrentView('sticky-notes')
text = text.replace("setShowStickyNotesModal(true)", "setCurrentView('sticky-notes')")

# Replace setIsModalOpen(true) with setCurrentView('add-word')
# Note: handleEdit already updated, but let's be sure of others
text = text.replace("setIsModalOpen(true)", "setCurrentView('add-word')")

# Replace setShowStickyNotesModal(false) with null/no-op or stay on page? 
# In closeModal we set back to home.
# Check if setShowStickyNotesModal(false) is used anywhere else.
text = text.replace("setShowStickyNotesModal(false)", "setCurrentView('home')")
text = text.replace("setIsModalOpen(false)", "setCurrentView('home')")

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
