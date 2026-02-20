
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
    
    if balance != 0 and i % 10000 == 0:
        # print(f"Char {i}: balance {balance}")
        pass

print(f"Final balance: {balance}")

# Find the last time balance was 0.
balance = 0
last_zero = 0
for i, char in enumerate(content):
    if char == '(':
        balance += 1
    elif char == ')':
        balance -= 1
    if balance == 0:
        last_zero = i

print(f"Last zero character index: {last_zero}")
print(f"Remaining content after last zero: '{content[last_zero+1:]}'")
