import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the Practice Test condition and Home Container.
# Find `<Container fluid className="main-app-container">`
container_idx = content.find('<Container fluid className="main-app-container">')

# Wait, it's easier to just use string replaces for specific lines.
# Replace: `<Container fluid className="main-app-container">` with
# `{currentView === 'home' && (<Container fluid className="main-app-container">`
content = content.replace(
    '<Container fluid className="main-app-container">',
    '{currentView === \'home\' && (<Container fluid className="main-app-container">'
)

# And close it near the end. We need to find `</Container>` which is around line 1966.
content = content.replace(
    '</Container>\n\n      {/* MOBILE BOTTOM NAVIGATION BAR */}',
    """</Container>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}"""
)

# Now remove the inline `{currentView === 'practice-test' ? ... : (`
practice_test_pattern = re.compile(
    r"\{currentView === 'practice-test' \? \([\s\S]*?practiceTests=\{practiceTests\}[\s\S]*?onDeleteAllTests=\{handleDeleteAllTests\}\n\s*?/>\n\s*?\) : \(\n\s*?<>",
    re.MULTILINE
)
# We actually just want to remove `{currentView === 'practice-test' ? (` and `) : (` and `</>` and replace them.
# Let's extract the PracticeTestContainer completely out, store it, and put it back below.
