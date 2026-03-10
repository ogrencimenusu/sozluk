import re

with open('src/index.css', 'r') as f:
    css = f.read()

root_addition = """
:root {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --bg-color: #0f172a;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --glass-bg: rgba(30, 41, 59, 0.7);
  --glass-border: rgba(255, 255, 255, 0.1);
  --card-bg: rgba(30, 41, 59, 0.5);
  --error: #ef4444;
  --body-bg-gradient: radial-gradient(at 0% 0%, hsla(253, 16%, 7%, 1) 0, transparent 50%),
                      radial-gradient(at 50% 0%, hsla(225, 39%, 30%, 0.2) 0, transparent 50%),
                      radial-gradient(at 100% 0%, hsla(339, 49%, 30%, 0.2) 0, transparent 50%);
  --modal-bg: #1e293b;
  --form-bg: rgba(15, 23, 42, 0.5);
  --search-bg: rgba(15, 23, 42, 0.6);
  --detail-box-bg: rgba(255, 255, 255, 0.03);
  --meaning-bg: rgba(15, 23, 42, 0.3);
  --accent-text: #a5b4fc;
  --highlight-text: #c7d2fe;
}

:root[data-theme='light'] {
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --bg-color: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(0, 0, 0, 0.1);
  --card-bg: rgba(255, 255, 255, 0.5);
  --error: #dc2626;
  --body-bg-gradient: radial-gradient(at 0% 0%, hsla(253, 16%, 95%, 1) 0, transparent 50%),
                      radial-gradient(at 50% 0%, hsla(225, 39%, 90%, 0.3) 0, transparent 50%),
                      radial-gradient(at 100% 0%, hsla(339, 49%, 90%, 0.3) 0, transparent 50%);
  --modal-bg: #ffffff;
  --form-bg: rgba(255, 255, 255, 0.5);
  --search-bg: rgba(255, 255, 255, 0.6);
  --detail-box-bg: rgba(0, 0, 0, 0.03);
  --meaning-bg: rgba(241, 245, 249, 0.5);
  --accent-text: #4f46e5;
  --highlight-text: #3730a3;
}
"""

css = re.sub(r':root\s*\{[^}]+\}', root_addition, css)

css = re.sub(
    r'background-image:[\s\S]*?radial-gradient[\s\S]*?radial-gradient[\s\S]*?radial-gradient[^;]+;',
    'background-image: var(--body-bg-gradient);',
    css
)

css = css.replace("background: rgba(15, 23, 42, 0.6);", "background: var(--search-bg);")
css = css.replace("color: white;\n  outline: none;", "color: var(--text-primary);\n  outline: none;")
css = css.replace("color: white;\n  margin-bottom: 0.5rem;", "color: var(--text-primary);\n  margin-bottom: 0.5rem;")
css = css.replace("color: #a5b4fc;", "color: var(--accent-text);")
css = css.replace("color: #cbd5e1;", "color: var(--text-secondary);")
css = css.replace("background: rgba(255, 255, 255, 0.03);", "background: var(--detail-box-bg);")
css = css.replace("background: #1e293b;", "background: var(--modal-bg);")
css = css.replace("color: white;\n}\n\n.close-btn", "color: var(--text-primary);\n}\n\n.close-btn")
css = css.replace("background: rgba(15, 23, 42, 0.5);", "background: var(--form-bg);")
css = css.replace("padding: 0.75rem 1rem;\n  color: white;", "padding: 0.75rem 1rem;\n  color: var(--text-primary);")
css = css.replace("color: #c7d2fe;", "color: var(--highlight-text);")
css = css.replace("background: rgba(255, 255, 255, 0.05);", "background: var(--detail-box-bg);")
css = css.replace("border-bottom: 1px solid rgba(255, 255, 255, 0.05);", "border-bottom: 1px solid var(--glass-border);")
css = css.replace("color: #f1f5f9;", "color: var(--text-primary);")
css = css.replace("background: rgba(15, 23, 42, 0.3);", "background: var(--meaning-bg);")
css = css.replace("color: white;\n  margin-bottom: 1rem;", "color: var(--text-primary);\n  margin-bottom: 1rem;")
css = css.replace("color: #a5b4fc !important;", "color: var(--accent-text) !important;")
css = css.replace("color: #e2e8f0;", "color: var(--text-primary);")

with open('src/index.css', 'w') as f:
    f.write(css)
