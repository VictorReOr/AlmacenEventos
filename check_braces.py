
import re

filename = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\data.ts'

with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    for j, char in enumerate(line):
        if char == '{':
            stack.append((i + 1, j + 1))
        elif char == '}':
            if not stack:
                print(f"Error: Unexpected '}}' at line {i + 1}, col {j + 1}")
            else:
                stack.pop()

if stack:
    print(f"Error: Unclosed '{{' at line {stack[-1][0]}, col {stack[-1][1]}")
    print(f"Total unclosed braces: {len(stack)}")
else:
    print("Braces are balanced.")
