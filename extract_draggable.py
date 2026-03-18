import os

warehouse_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\WarehouseMap.tsx'
draggable_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\components\Map\DraggableObject.tsx'

with open(warehouse_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find bounds
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if line.startswith('interface DraggablePalletProps'):
        start_idx = i
    if line.startswith('const WarehouseMap = forwardRef'):
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    # DraggableObject usually ends a few lines before WarehouseMap. We'll search backwards from end_idx for `};`
    actual_end_idx = end_idx - 1
    while actual_end_idx > start_idx and not lines[actual_end_idx].strip().startswith('};'):
        actual_end_idx -= 1
        
    draggable_lines = lines[start_idx:actual_end_idx + 1]
    
    # Imports for DraggableObject
    imports = """import React, { useState, useRef, useMemo } from 'react';
import { useGesture } from '@use-gesture/react';
import type { Ubicacion } from '../../types';
import { getCorners, polygonsIntersect, calculateSnap, projectPointOnSegment } from '../../geometry';
import type { SnapLine } from '../../geometry';
import { ShelfGraphic } from './ShelfGraphic';
import { PalletGraphic } from './PalletGraphic';

const SCALE = 35; // px por metro
const SHELF_MODULE_WIDTH = 1.0; 
const SHELF_DEPTH = 0.45;

"""
    # Replace the `const DraggableObject` with `export const DraggableObject`
    new_draggable_content = []
    for line in draggable_lines:
        if line.startswith('const DraggableObject:'):
            new_draggable_content.append(line.replace('const DraggableObject:', 'export const DraggableObject:'))
        else:
            new_draggable_content.append(line)
            
    with open(draggable_path, 'w', encoding='utf-8') as f:
        f.write(imports + "".join(new_draggable_content))
        
    # Rewrite WarehouseMap.tsx
    new_warehouse_lines = lines[:start_idx] + ["import { DraggableObject } from './components/Map/DraggableObject';\n\n"] + lines[actual_end_idx + 1:]
    
    with open(warehouse_path, 'w', encoding='utf-8') as f:
        f.writelines(new_warehouse_lines)
    print("Successfully refactored DraggableObject")
else:
    print(f"Extraction failed. start: {start_idx}, end: {end_idx}")
