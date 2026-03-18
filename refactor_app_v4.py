import os

app_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\App.tsx'

with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    line_num = i + 1
    
    # Ranges to exclude (1-indexed, inclusive)
    if 92 <= line_num <= 137:
        if line_num == 92:
            # Inject hook exactly here
             new_lines.append("""  const {
    state, pushState, undo, redo, canUndo, canRedo,
    selectedIds, setSelectedIds, handleSelectLocation, handleDeleteSelection, handleCreatePallet,
    isSelectionMode, setIsSelectionMode, selectedLocation,
    editMapMode, setEditMapMode, showGrid, setShowGrid, activeFilter, setActiveFilter,
    programColors, setProgramColors, isEditModeGlobal, setIsEditModeGlobal,
    scriptUrl, setScriptUrl, isSyncing, handleSaveToCloud, handleLoadFromCloud, handleExportDataTS, handleUpdate,
    inventoryErrors, showErrorsModal, setShowErrorsModal, assistantAlert, setAssistantAlert,
    showLegendModal, setShowLegendModal,
    showPrintModal, setShowPrintModal, printData, setPrintData, handlePrint, handlePrintSingle,
    mapRef
  } = useWarehouseState(user);
""")
        continue
    
    if line_num == 140: continue
    if 142 <= line_num <= 143: continue
    if line_num == 146: continue
    if 189 <= line_num <= 191: continue
    if 193 <= line_num <= 227: continue
    if 231 <= line_num <= 232: continue
    if 236 <= line_num <= 686: continue
    
    # We keep everything else!
    # Wait, we must insert the import for useWarehouseState
    if line_num == 58: # Right after useHistory import
        new_lines.append("import { useWarehouseState } from './hooks/useWarehouseState';\n")
    
    new_lines.append(line)

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
    
print("App.tsx fixed")
