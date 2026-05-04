
import sys

file_path = 'src/App.jsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
found = False
for line in lines:
    if 'const root = nlp(term).verbs().toInfinitive().text().toLowerCase() || nlp(term).nouns().toSingular().text().toLowerCase() || term;' in line:
        indent = line[:line.find('const')]
        new_lines.append(f"{indent}const doc = nlp(term);\n")
        new_lines.append(f"{indent}let root = doc.verbs().toInfinitive().text().toLowerCase();\n")
        new_lines.append(f"{indent}if ((!root || root === term) && (term.endsWith('ing') || term.endsWith('ed'))) {{\n")
        new_lines.append(f"{indent}  root = nlp(term).tag('Verb').verbs().toInfinitive().text().toLowerCase();\n")
        new_lines.append(f"{indent}}}\n")
        new_lines.append(f"{indent}if (!root || root === term) {{\n")
        new_lines.append(f"{indent}  root = doc.nouns().toSingular().text().toLowerCase();\n")
        new_lines.append(f"{indent}}}\n")
        found = True
    else:
        new_lines.append(line)

if found:
    with open(file_path, 'w') as f:
        f.writelines(new_lines)
    print("Success")
else:
    print("Not found")
