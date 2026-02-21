
import os

filepath = r'e:\project\workspace\WOS-Commander\app\index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines):
    # Strip comments to avoid false positives
    code = line.split('//')[0]
    # Simple count - doesn't handle strings but usually okay for this file
    opens = code.count('(')
    closes = code.count(')')
    balance += opens - closes
    if balance != 0 and i > 4000: # Focused on recent changes
         pass
    # We want to find the line where it goes from 0 to 1 and never back to 0.
    # Or just print all lines where it changed.

print(f"Final: {balance}")

# Let's find the last line where it WAS zero.
last_zero = -1
for i, line in enumerate(lines):
    code = line.split('//')[0]
    balance_before = balance
    # Wait, reset balance and check from start
# ... (reset)

balance = 0
for i, line in enumerate(lines):
    code = line.split('//')[0]
    balance += code.count('(') - code.count(')')
    if balance == 0:
        last_zero = i

print(f"Last zero at line: {last_zero + 1}")
if last_zero < len(lines) - 1:
    print("Balance after last zero:")
    for i in range(last_zero + 1, len(lines)):
        print(f"{i+1}: {lines[i].strip()}")
