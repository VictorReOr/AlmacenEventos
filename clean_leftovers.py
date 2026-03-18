import os

hook_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\hooks\useWarehouseState.ts'
app_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\App.tsx'

# 1. Fix Hook
with open(hook_path, 'r', encoding='utf-8') as f:
    hook_lines = f.readlines()

new_hook_lines = []
for i, line in enumerate(hook_lines):
    if "const selectedLocation = (selectedIds.size === 1)" in line:
        # Check if the NEXT line or PREVIOUS line is near 'getInitialState' or catch block
        # We know it was injected before `return { ubicaciones: ... }`
        if i + 1 < len(hook_lines) and "return { ubicaciones:" in hook_lines[i+1]:
            continue # drop it
        if i + 2 < len(hook_lines) and "return { ubicaciones:" in hook_lines[i+2]:
            continue # drop it
            
    new_hook_lines.append(line)

with open(hook_path, 'w', encoding='utf-8') as f:
    f.writelines(new_hook_lines)

# 2. Fix App.tsx Imports
with open(app_path, 'r', encoding='utf-8') as f:
    app_lines = f.readlines()

new_app_lines = []
skip = False
for line in app_lines:
    if line.startswith('// Lógica y Tipos'):
        skip = True
        continue
    if skip and line.startswith('// Estilos'):
        skip = False
        new_app_lines.append(line)
        continue
    if skip:
        continue
    
    # Also remove useHistory if it's there
    if 'import { useHistory }' in line:
        continue
        
    # Remove useWarehouseState duplicated import if any? No, it should be single.
    
    new_app_lines.append(line)

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_app_lines)

print("Cleanup done")
