import os

app_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\App.tsx'
hook_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\hooks\useWarehouseState.ts'

with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'const getInitialState = () => {' in line:
        start_idx = i
        break

for i, line in enumerate(lines):
    if '  const selectedLocation = ' in line:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    extracted_lines = lines[start_idx:end_idx + 1]
    
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
    showLegendModal, setShowLegendModal,
    showPrintModal, setShowPrintModal, printData, setPrintData, handlePrint, handlePrintSingle,
    mapRef
  };
}
"""

    with open(hook_path, 'w', encoding='utf-8') as f:
        f.write(hook_imports)
        f.write("  const mapRef = useRef<WarehouseMapRef>(null);\n")
        
        # Remove mapRef from extracted to avoid duplication, and also isMobile (passed or used from hook?)
        # App.tsx has `const isMobile = useIsMobile();` at line 233. We should extract that to hook if needed, or leave in App.
        # Actually, isMobile is used in App.tsx for UI rendering. Wait, is it used in the hook?
        # Let's check: handleUpdate, handleCreatePallet don't use isMobile.
        
        clean_extracted = []
        for line in extracted_lines:
            if 'const mapRef = useRef<WarehouseMapRef>(null);' in line:
                continue
            if 'console.log("AuthenticatedApp: useAuth() called");' in line:
                continue
            if 'const { user, logout } = useAuth();' in line:
                continue
            if 'const isMobile = useIsMobile();' in line:
                # Keep it in App.tsx, do NOT put in hook
                continue
            clean_extracted.append(line)
            
        f.writelines(clean_extracted)
        f.write(hook_return)
        
    app_replacement = """  const {
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
  
  const isMobile = useIsMobile();
"""

    new_app_lines = lines[:start_idx] + [app_replacement] + lines[end_idx + 1:]
    
    last_import_idx = 0
    for i, line in enumerate(new_app_lines):
        if line.startswith('import '):
            last_import_idx = i
            
    new_app_lines.insert(last_import_idx + 1, "import { useWarehouseState } from './hooks/useWarehouseState';\n")
    
    with open(app_path, 'w', encoding='utf-8') as f:
        f.writelines(new_app_lines)
    
    print("Done refactoring App.tsx")
else:
    print(f"Failed to find bounds. Start: {start_idx}, End: {end_idx}")
