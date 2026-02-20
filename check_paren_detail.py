
import os

filepath = r'e:\project\workspace\WOS-Commander\app\index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines):
    # Ignore comments
    content = line.split('//')[0]
    opens = content.count('(')
    closes = content.count(')')
    balance += (opens - closes)
    if balance != 0 and (opens != closes):
        # We can't easily find the exact line because many lines span multiple parens
        pass

print(f"Final balance: {balance}")
