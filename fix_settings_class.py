with open('src/components/pages/SettingsPage.jsx', 'r', encoding='utf-8') as f:
    text = f.read()
# Wrap in main-app-container class and add px-0 to the inner container to avoid double padding if needed
# Actually just changing the outer div class is enough
text = text.replace('className="animation-fade-in"', 'className="main-app-container animation-fade-in"')
with open('src/components/pages/SettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
