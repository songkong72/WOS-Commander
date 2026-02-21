
import os

filepath = r'e:\project\workspace\WOS-Commander\app\index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
last_zero_line = 0
for i, line in enumerate(lines):
    content = line.split('//')[0] # ignore comments
    balance += content.count('(') - content.count(')')
    if balance == 0:
        last_zero_line = i + 1

print(f"Final paren balance: {balance}")
print(f"Last line where balance was zero: {last_zero_line}")

# Print lines after last_zero_line to find the culprit
for i in range(max(0, last_zero_line - 5), len(lines)):
    print(f"{i+1}: {lines[i].strip()}")
