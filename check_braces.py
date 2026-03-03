import ast
try:
    with open('src/data.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    # Just load it using some basic regex checks or maybe we just check the file
    print('Testing data.ts structure')
except Exception as e:
    print(f'Error: {e}')
