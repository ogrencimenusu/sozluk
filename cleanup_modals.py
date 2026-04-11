import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update WordDetailModal prop
text = text.replace("onOpenNotesModal={() => setShowStickyNotesModal(true)}", "onOpenNotesModal={() => setCurrentView('sticky-notes')}")

# 2. Remove Sticky Notes List Modal
# It starts with {/* STICKY NOTES LIST MODAL */}
# And ends with </Modal>
modal_pattern = re.compile(r"\{\/\* STICKY NOTES LIST MODAL \*\/\}\n\s*<Modal[\s\S]*?show=\{showStickyNotesModal\}[\s\S]*?<\/Modal>", re.MULTILINE)
text = re.sub(modal_pattern, "", text)

# 3. Also check for NEW WORD MODAL just in case it's still there
new_word_modal_pattern = re.compile(r"\{\/\* NEW WORD MODAL \*\/\}\n\s*<Modal[\s\S]*?show=\{isModalOpen\}[\s\S]*?<\/Modal>", re.MULTILINE)
text = re.sub(new_word_modal_pattern, "", text)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
