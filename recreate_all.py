import os

app_backup_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\App.tsx.backup'
app_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\App.tsx'
hook_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\hooks\useWarehouseState.ts'

with open(app_backup_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if 'const getInitialState = () => {' in line:
        start_idx = i
        break

end_idx = -1
for i, line in enumerate(lines):
    if '  const selectedLocation = ' in line:
        end_idx = i
        break

extracted = lines[start_idx:end_idx]

clean_extracted = []
skip = False
for line in extracted:
    if 'const [isChatbotOpen' in line: continue
    if 'const [pendingAssistantAction' in line: continue
    if 'const [isAdminOpen' in line: continue
    if 'const [viewMode' in line: continue
    if 'const assistantRef =' in line: continue
    if 'const [assistantPos' in line: continue
    if 'const [{ x, y }, api] = useSpring' in line: continue
    
    if 'const bindAssistantDrag = useDrag' in line:
        skip = True
        continue
    if skip and '  });' in line:
        skip = False
        continue
    if skip: continue
    
    if 'const [isPortrait' in line: continue
    if 'const { user, logout } = useAuth();' in line: continue
    if 'console.log("AuthenticatedApp: useAuth() called");' in line: continue
    if 'const isMobile = useIsMobile();' in line: continue
    if 'const mapRef = useRef<WarehouseMapRef>(null);' in line: continue

    clean_extracted.append(line)

for i in range(len(clean_extracted) - 1):
    if 'useEffect(() => {' in clean_extracted[i] and 'const handleResize =' in clean_extracted[i+1]:
        del clean_extracted[i:i+5]
        break

hook_imports = """import { useState, useEffect, useRef } from 'react';
import { useHistory } from './useHistory';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { AssistantService } from '../services/AssistantService';
import { InventoryService } from '../services/InventoryService';
import { validateInventory } from '../utils/inventoryValidation';
import { sanitizeState } from '../utils/cleanup';
import { generateInitialState } from '../data';
import { PROGRAM_COLORS } from '../types';
import type { Ubicacion } from '../types';
import type { PrintOptions } from '../components/UI/PrintModal';
import type { InventoryError } from '../utils/inventoryValidation';
import type { WarehouseMapRef } from '../WarehouseMap';

export function useWarehouseState(user: any) {
  const mapRef = useRef<WarehouseMapRef>(null);
"""
hook_return = """
  return {
    state, pushState, undo, redo, canUndo, canRedo,
    selectedIds, setSelectedIds, handleSelectLocation, handleDeleteSelection, handleCreatePallet,
    isSelectionMode, setIsSelectionMode, selectedLocation,
    editMapMode, setEditMapMode, showGrid, setShowGrid, activeFilter, setActiveFilter, 
    programColors, setProgramColors, isEditModeGlobal, setIsEditModeGlobal,
    scriptUrl, setScriptUrl, isSyncing, handleSaveToCloud, handleLoadFromCloud, handleExportDataTS, handleUpdate,
    inventoryErrors, showErrorsModal, setShowErrorsModal, assistantAlert, setAssistantAlert, 
    showLegendModal, setShowLegendModal, showConfig, setShowConfig,
    showPrintModal, setShowPrintModal, printData, setPrintData, handlePrint, handlePrintSingle,
    mapRef
  };
}
"""

with open(hook_path, 'w', encoding='utf-8') as f:
    f.write(hook_imports)
    f.writelines(clean_extracted)
    f.write(hook_return)

# Now fix App.tsx:
new_app_lines = []
for i, line in enumerate(lines):
    line_num = i + 1
    
    if 92 <= line_num <= 137:
        if line_num == 92:
             # Inject the hook call AFTER useAuth
             new_app_lines.append('  const { user, logout } = useAuth();\n')
             new_app_lines.append("""  const {
    state, pushState, undo, redo, canUndo, canRedo,
    selectedIds, setSelectedIds, handleSelectLocation, handleDeleteSelection, handleCreatePallet,
    isSelectionMode, setIsSelectionMode, selectedLocation,
    editMapMode, setEditMapMode, showGrid, setShowGrid, activeFilter, setActiveFilter,
    programColors, setProgramColors, isEditModeGlobal, setIsEditModeGlobal,
    scriptUrl, setScriptUrl, isSyncing, handleSaveToCloud, handleLoadFromCloud, handleExportDataTS, handleUpdate,
    inventoryErrors, showErrorsModal, setShowErrorsModal, assistantAlert, setAssistantAlert,
    showLegendModal, setShowLegendModal, showConfig, setShowConfig,
    showPrintModal, setShowPrintModal, printData, setPrintData, handlePrint, handlePrintSingle,
    mapRef
  } = useWarehouseState(user);
""")
        continue
    
    if line_num == 140: continue # lastFocusedId
    if 142 <= line_num <= 143: continue # alert, filter
    if 144 <= line_num <= 146: continue # useAuth, mapRef
    if 189 <= line_num <= 192: continue # config, sync, grid, config
    if 193 <= line_num <= 228: continue # editMapMode, programColors, useEffect, etc. (all state down to isSelectionMode)
    if 231 <= line_num <= 232: continue # selectionMode, editModeGlobal
    if 236 <= line_num <= 686: continue # logic
    
    if line_num == 58:
        new_app_lines.append("import { useWarehouseState } from './hooks/useWarehouseState';\n")
    
    new_app_lines.append(line)

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_app_lines)
    
print("Recreated both perfectly.")
