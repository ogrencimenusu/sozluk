import re

# Update index.css
with open('src/index.css', 'r', encoding='utf-8') as f:
    text = f.read()

padding_styles = """
.main-app-container {
  padding-left: 15px !important;
  padding-right: 15px !important;
  padding-bottom: 90px !important;
  transition: all 0.3s ease;
}

@media (min-width: 768px) {
  .main-app-container {
    padding-left: 30px !important;
    padding-right: 30px !important;
  }
}
"""

text = re.sub(r"\.main-app-container \{[\s\S]*?\}", padding_styles.strip(), text)
with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(text)

# Update PageHeader.jsx to be more compact horizontally
with open('src/components/layout/PageHeader.jsx', 'r', encoding='utf-8') as f:
    header = f.read()
header = header.replace('px-3 py-3', 'px-2 px-md-3 py-3')
with open('src/components/layout/PageHeader.jsx', 'w', encoding='utf-8') as f:
    f.write(header)

