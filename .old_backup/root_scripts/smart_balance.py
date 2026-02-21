
import os
import re

filepath = r'e:\project\workspace\WOS-Commander\app\index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove comments
content = re.sub(r'//.*', '', content)
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

# Remove regex literals (simplified)
# This is tricky because / can be division. But in this file it's mostly regex in .match()
content = re.sub(r'\.match\(/.+?/\)', '.match(REGEX)', content)

# Remove string literals
# Single quotes
content = re.sub(r"'.*?'", "''", content)
# Double quotes
content = re.sub(r'".*?"', '""', content)
# Template literals
content = re.sub(r'`.*?`', '``', content, flags=re.DOTALL)

balance = 0
stack = []
lines = content.split('\n')
for i, line in enumerate(lines):
    for char in line:
        if char == '(':
            stack.append(i + 1)
        elif char == ')':
            if stack:
                stack.pop()
            else:
                print(f"Extra closing paren at line {i+1}")

if stack:
    print(f"Final imbalance: {len(stack)}")
    print(f"Opening parens from lines: {stack}")
else:
    print("Perfect balance!")
