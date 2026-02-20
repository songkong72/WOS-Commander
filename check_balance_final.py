
import os

filepath = r'e:\project\workspace\WOS-Commander\app\index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

balance = 0
for i, char in enumerate(content):
    if char == '(':
        balance += 1
    elif char == ')':
        balance -= 1
    
    if balance < 0:
        print(f"Paren balance became negative at char {i} (line {content[:i].count('\n') + 1})")
        # break

print(f"Final paren balance: {balance}")

brace_balance = 0
for i, char in enumerate(content):
    if char == '{':
        brace_balance += 1
    elif char == '}':
        brace_balance -= 1
    
    if brace_balance < 0:
        print(f"Brace balance became negative at char {i} (line {content[:i].count('\n') + 1})")
        # break

print(f"Final brace balance: {brace_balance}")
