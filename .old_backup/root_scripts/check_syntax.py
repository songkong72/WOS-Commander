
import re

file_path = r'e:\project\workspace\WOS-Commander\app\index.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

def count_braces(content):
    o = len(re.findall(r'\{', content))
    c = len(re.findall(r'\}', content))
    return o, c

def count_parens(content):
    o = len(re.findall(r'\(', content))
    c = len(re.findall(r'\)', content))
    return o, c

ob, cb = count_braces(content)
op, cp = count_parens(content)

print(f"Braces: {ob} / {cb} (Diff: {ob-cb})")
print(f"Parens: {op} / {cp} (Diff: {op-cp})")
