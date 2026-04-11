import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Wrap the Main Home Container
text = text.replace(
    '<Container fluid className="main-app-container">',
    "{currentView === 'home' && (\n      <Container fluid className=\"main-app-container\">"
)

# 2. Extract PracticeTestContainer conditionally outside the Home Container.
# First, remove the ternary
start_ternary = "            {currentView === 'practice-test' ? ("
end_ternary_block = """                onDeleteAllTests={handleDeleteAllTests}
              />
            ) : ("""

idx1 = text.find(start_ternary)
if idx1 != -1:
    idx2 = text.find(end_ternary_block, idx1)
    if idx2 != -1:
        # Extract the PracticeTestContainer element
        practice_test_html = text[idx1 + len(start_ternary) : idx2 + len(end_ternary_block) - 17] # Up to />
        
        # Replace the ternary with just nothing (so the inside becomes the main content of Home Container)
        text = text[:idx1] + text[idx2 + len(end_ternary_block):]
        # Also remove the remaining `<>\n`
        text = text.replace("              <>\n", "", 1)
        
        # Now find the closing parenthesis of the ternary which is around `</main>\n              </>\n            )}`
        end_ternary_str = "              </main>\n              </>\n            )}"
        text = text.replace(end_ternary_str, "              </main>\n      </Container>\n      )}")
        
        # Now, insert the separated views below the home container.
        # It's currently `)}` that we just placed. We'll find that and add others below it.
        closing_container = "      </Container>\n      )}"
        idx3 = text.find(closing_container)
        
        if idx3 != -1:
            views_block = f"""
      {{/* Practice Test Page */}}
      {{currentView === 'practice-test' && (
        <Container fluid className="main-app-container">
          <PageHeader title="Test Çöz" icon="bi-controller" onBack={{() => setCurrentView('home')}} theme={{theme}} toggleTheme={{toggleTheme}} />
          {practice_test_html.strip()}
        </Container>
      )}}
"""
            text = text[:idx3 + len(closing_container)] + "\n" + views_block + text[idx3 + len(closing_container):]

# Write out the new text
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

