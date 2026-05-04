
import sys

file_path = 'src/App.jsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if '{(() => {' in line and 'const term = word.term.toLowerCase().trim();' in lines[i+1]:
        indent = line[:line.find('{')]
        new_lines.append(f"{indent}{{word.rootWord && (\n")
        new_lines.append(f"{indent}  <span className=\"text-muted small fst-italic ms-1\" style={{{{ fontSize: '0.65rem', opacity: 0.8 }}}}>\n")
        new_lines.append(f"{indent}    ({{word.rootWord}})\n")
        new_lines.append(f"{indent}  </span>\n")
        new_lines.append(f"{indent})}}\n")
        skip = True
    elif skip and '})()}' in line:
        skip = False
    elif not skip:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print("Success")
