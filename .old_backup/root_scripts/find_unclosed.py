
import os

filepath = r'e:\project\workspace\WOS-Commander\app\index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines):
    code = line.split('//')[0]
    # Simple count
    b_prev = balance
    balance += code.count('(') - code.count(')')
    if balance != b_prev:
        # print(f"{i+1}: {balance} ({line.strip()})")
        pass

print(f"Final balance: {balance}")

# Let's find where it's not matching anymore.
# We can use a stack to find the exact line of the unclosed paren.
stack = []
for i, line in enumerate(lines):
    code = line.split('//')[0]
    for char in code:
        if char == '(':
            stack.append(i + 1)
        elif char == ')':
            if stack:
                stack.pop()
            else:
                print(f"Extra closing paren at line {i+1}")

if stack:
    print(f"Unclosed opening parens from lines: {stack}")
