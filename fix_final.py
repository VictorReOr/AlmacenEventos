import os

hook_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\hooks\useWarehouseState.ts'
app_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\App.tsx'

# Fix Hook
with open(hook_path, 'r', encoding='utf-8') as f:
    hook_lines = f.readlines()

new_hook_lines = []
for line in hook_lines:
    if line.strip().startswith('return {'):
        new_hook_lines.append("  const selectedLocation = (selectedIds.size === 1) ? state.ubicaciones[Array.from(selectedIds)[0]] : null;\n\n")
    new_hook_lines.append(line)

with open(hook_path, 'w', encoding='utf-8') as f:
    f.writelines(new_hook_lines)

# Fix App.tsx
with open(app_path, 'r', encoding='utf-8') as f:
    app_lines = f.readlines()

new_app_lines = []
skip_next = False
for i, line in enumerate(app_lines):
    if line.startswith("import { PrintModal } from './components/UI/PrintModal';") and app_lines[i-1].startswith("import { PrintModal }"):
        continue # skip duplicate
        
    if line.startswith("import { PrintView } from './components/Print/PrintView';"):
        new_app_lines.append("import { InventoryErrorsModal } from './components/Admin/InventoryErrorsModal';\n")
        
    if "import { PROGRAM_COLORS } from './types';" in line:
        continue # we don't need it in App since it's in hook
        
    new_app_lines.append(line)

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_app_lines)

print("Fixed final TS issues")
