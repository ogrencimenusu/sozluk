import re

# Fix SettingsPage.jsx imports and structure
with open('src/components/pages/SettingsPage.jsx', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('import { Row, Col, Card } from \'react-bootstrap\';', 'import { Container, Row, Col, Card } from \'react-bootstrap\';')
# Ensure no div bleed
text = text.replace('<Container className="py-4 px-2 px-md-4">', '<Container className="py-4 px-2 px-md-4" style={{ maxWidth: "100%", overflowX: "hidden" }}>')
with open('src/components/pages/SettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

# Fix StickyNotesPage.jsx imports and structure
with open('src/components/pages/StickyNotesPage.jsx', 'r', encoding='utf-8') as f:
    text = f.read()
# Add overflow settings to row or container
text = text.replace('<Row className="justify-content-center">', '<Row className="justify-content-center mx-0">') # mx-0 removes negative margins
# Also handle the "Manuel Not" casing
text = text.replace("note.wordTerm === 'Manuel Not'", "(note.wordTerm === 'Manuel Not' || note.wordTerm === 'MANUEL NOT' || !note.wordTerm)")
with open('src/components/pages/StickyNotesPage.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

