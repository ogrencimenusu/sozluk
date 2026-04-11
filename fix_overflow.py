import re

# 1. Update App.jsx top level div
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('<div className="min-vh-100 py-4">', '<div className="min-vh-100 py-4 overflow-x-hidden">')
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

# 2. Update SettingsPage.jsx - wrap Row in Container or use mx-0
with open('src/components/pages/SettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
# Replace the div around Row with a Container
content = content.replace('<div className="py-4 px-2 px-md-4">', '<Container className="py-4 px-2 px-md-4">')
content = content.replace('      </Row>\n      </div>', '      </Row>\n      </Container>')
with open('src/components/pages/SettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

# 3. Update StickyNotesPage.jsx - Ensure no overflow
with open('src/components/pages/StickyNotesPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
# Add overflow-hidden to the item wrapper
content = content.replace('className="sticky-note-list-item d-flex align-items-start gap-3 p-3"', 'className="sticky-note-list-item d-flex align-items-start gap-3 p-3 overflow-hidden"')
with open('src/components/pages/StickyNotesPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

