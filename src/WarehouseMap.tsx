import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useGesture } from '@use-gesture/react';
import type { Ubicacion } from './types';
import styles from './WarehouseMap.module.css';
import { getCorners, polygonsIntersect, calculateSnap, generateWallsFromFloor, projectPointOnSegment } from './geometry';
import type { SnapLine } from './geometry';

// Import Data & Hooks
// import { generateInitialState } from './data';
// import { useLocalStorage } from './hooks/useLocalStorage';

// const initialState = generateInitialState();


interface WarehouseMapProps {
    ubicaciones: Record<string, Ubicacion>;
    onSelectLocation: (id: string, modifiers?: { toggle?: boolean, range?: boolean }) => void;
    selectedIds: Set<string>;
    onUpdate: (u: Ubicacion | Ubicacion[]) => void;
    geometry: { x: number; y: number }[];
    onUpdateGeometry: (newGeo: { x: number; y: number }[]) => void;
    onSelectMultiple?: (ids: string[]) => void;
    rotationMode?: 'normal' | 'vertical-ccw';
    showGrid?: boolean;
    programColors?: Record<string, string>; // Optional to stay backward compatible or default
}

export interface WarehouseMapRef {
    getViewCenter: () => { x: number, y: number };
}

const SCALE = 35; // px per meter
const SHELF_MODULE_WIDTH = 1.0; // Hardcoded fix
const SHELF_DEPTH = 0.45;       // Hardcoded fix

// --- INTERACTION COMPONENT ---

interface DraggablePalletProps {
    u: Ubicacion;
    isSelected: boolean;
    dragState: { id: string, x: number, y: number, rot: number, valid: boolean, w?: number, d?: number, groupIds?: string[], deltaX?: number, deltaY?: number } | null;
    setDragState: (s: { id: string, x: number, y: number, rot: number, valid: boolean, w?: number, d?: number, groupIds?: string[], deltaX?: number, deltaY?: number } | null) => void;
    onSelectLocation: (id: string, modifiers?: { toggle?: boolean, range?: boolean }) => void;
    onUpdate: (u: Ubicacion | Ubicacion[]) => void;
    toSVG: (x: number, y: number) => { x: number, y: number };
    otherObstacles: Ubicacion[];
    allObjects: Record<string, Ubicacion>;
    setSnapLines: (lines: SnapLine[]) => void;
    walls: { x: number; y: number }[][];
    selectedIds: Set<string>;
    geometry: { x: number; y: number }[];
    zoomScale: number;
    rotationMode?: 'normal' | 'vertical-ccw';
    programColors: Record<string, string>;
}

const DraggableObject: React.FC<DraggablePalletProps> = ({ u, isSelected, dragState, setDragState, onSelectLocation, onUpdate, toSVG, otherObstacles, allObjects, setSnapLines, walls, selectedIds, geometry, zoomScale, rotationMode = 'normal', programColors }) => {
    const isLeaderDragging = dragState?.id === u.id;
    const isGroupDragging = dragState?.groupIds?.includes(u.id);

    const isDragging = isLeaderDragging || isGroupDragging;

    // Local Interaction Mode
    const [interactionMode, setInteractionMode] = useState<'move' | 'resize' | 'rotate' | null>(null);

    // Current State (Visual)
    const currentX = isDragging ? (isLeaderDragging ? dragState.x : (dragState?.deltaX !== undefined ? u.x + dragState.deltaX : u.x)) : u.x;
    const currentY = isDragging ? (isLeaderDragging ? dragState.y : (dragState?.deltaY !== undefined ? u.y + dragState.deltaY : u.y)) : u.y;
    const currentRot = (isLeaderDragging && dragState) ? dragState.rot : u.rotation;
    const currentW = (isLeaderDragging && dragState?.w) ? dragState.w : u.width;
    const currentD = (isLeaderDragging && dragState?.d) ? dragState.d : u.depth;

    const { sw: finalSvgW, sh: finalSvgH } = (() => {
        if (rotationMode === 'vertical-ccw') {
            return { sw: currentW * SCALE, sh: currentD * SCALE };
        }
        return { sw: currentD * SCALE, sh: currentW * SCALE };
    })();
    const s = toSVG(currentX, currentY);

    const isValid = isLeaderDragging ? dragState?.valid : true;
    const color = isValid ? (programColors[u.programa] || '#999') : '#ff4444';

    const stroke = isSelected ? '#2196F3' : '#333';

    // --- MOVE GESTURE WITH SNAPPING ---
    const rawPos = useRef({ x: u.x, y: u.y }); // Tracks unsnapped position
    const dragMeta = useRef({ groupIds: [] as string[] }); // Sync storage for drag session

    const bindMove = useGesture({
        onDragStart: ({ event }) => {
            event.stopPropagation();
            hasDragged.current = false;
            // console.log('Drag Start', u.id, 'Selected:', isSelected, 'SelectedIds:', Array.from(selectedIds));
            if (!isSelected) {
                onSelectLocation(u.id);
            }

            setInteractionMode('move');
            rawPos.current = { x: u.x, y: u.y };

            // Group Dragging Logic:
            let groupIds: string[] = [];
            if (isSelected) {
                groupIds = Array.from(selectedIds);
            } else {
                groupIds = [u.id];
            }
            // console.log('GroupIds for drag:', groupIds);

            // Store synchronously for onDrag
            dragMeta.current.groupIds = groupIds;

            setDragState({
                id: u.id, x: u.x, y: u.y, rot: u.rotation, valid: true, w: u.width, d: u.depth,
                groupIds, deltaX: 0, deltaY: 0
            });
        },
        onDrag: ({ pinching, cancel, event, last, delta: [dx, dy] }) => {
            // Lock Shelves (Prevent Dragging) -> DISABLED: User wants to move shelves
            /*
            if (u.tipo === 'estanteria_modulo') {
                return cancel();
            }
            */

            if (pinching) return cancel();
            event.stopPropagation();
            hasDragged.current = true;

            let uDx = 0;
            let uDy = 0;

            if (rotationMode === 'vertical-ccw') {
                // Vertical Mode:
                // Screen X (dx) -> User X (Width)
                // Screen Y (dy) -> User Y (Length) IS INVERTED (Up Screen = Incr Y? No, Up Screen = Decr Y Screen = Incr User Y?)
                // toSVG: yScreen = (29 - uY) * S.
                // dy = S * -duY => duY = -dy / S.
                // dx = S * duX => duX = dx / S.

                uDx = dx / SCALE / zoomScale;
                uDy = -dy / SCALE / zoomScale;
            } else {
                // Horizontal Mode (Original):
                // User X (Height of SVG) -> Screen Y
                // User Y (Width of SVG) -> Screen X
                uDx = dy / SCALE / zoomScale;
                uDy = dx / SCALE / zoomScale;
            }

            // console.log('Dragging', u.id, dx, dy, uDx, uDy);

            rawPos.current.x += uDx;
            rawPos.current.y += uDy;

            let newX = rawPos.current.x;
            let newY = rawPos.current.y;

            // Use synchronous ref instead of state to ensure we have groupIds
            const groupIds = dragMeta.current.groupIds;

            // Filter obstacles: Exclude dragging group members
            const validObstacles = otherObstacles.filter(o => !groupIds.includes(o.id));

            // Add Walls as Snapping Targets
            // Convert geometry segments to "thin obstacles" for snapping
            const wallSnaps: any[] = [];
            if (geometry && geometry.length > 2) {
                for (let i = 0; i < geometry.length; i++) {
                    const p1 = geometry[i];
                    const p2 = geometry[(i + 1) % geometry.length];

                    // Project current center onto the wall segment
                    const proj = projectPointOnSegment({ x: newX, y: newY }, p1, p2);

                    // Calculate Wall Vector in User Space for rotation
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;

                    // Angle in SVG Space (Where rotation is applied)
                    const angleRad = Math.atan2(dx, dy);
                    const angleDeg = angleRad * (180 / Math.PI);

                    // Create a "Point Magnet" on the wall at the closest location
                    // This allows the object to snap its edge to this specific point on the wall
                    wallSnaps.push({
                        x: proj.x, y: proj.y,
                        width: 0.001, // Point-like
                        depth: 0.001, // Point-like
                        rotation: angleDeg
                    });
                }
            }

            const isAlt = event.altKey;

            // Snap (Only for Leader)
            let snappedX = newX;
            let snappedY = newY;
            let lines: SnapLine[] = [];

            if (!isAlt) {
                const isShelf = u.tipo === 'estanteria_modulo';
                // If Shelf, Disable ALL Snapping (User wants total control)
                // Fix TS error: explicit cast or broaden type if needed, but here we just ensure snapTargets is correct type
                // snapTargets expects objects with {x,y,width,depth,rotation}. 
                // validObstacles are Ubicacion (which has these).
                const snapTargets: any[] = isShelf
                    ? []
                    : [...validObstacles.map(o => ({ x: o.x, y: o.y, width: o.width, depth: o.depth, rotation: o.rotation })), ...wallSnaps];

                const snapResult = calculateSnap(
                    newX, newY, currentW, currentD, currentRot,
                    snapTargets,
                    isShelf // Ignore Gap for Shelves
                );
                snappedX = snapResult.x;
                snappedY = snapResult.y;
                lines = snapResult.lines;

                // Auto-Rotate to match Snap Target (e.g. Wall)
                if (snapResult.snappedRotation !== undefined) {
                    // Only auto-rotate if significantly different? 
                    // Or always valid?
                    // Let's assume snap target rotation is "correct"

                    // We need to update the rotation THIS FRAME so collision check works
                    // But currentRot is const. Let's make a local override.
                }
            }

            newX = snappedX;
            newY = snappedY;
            setSnapLines(lines);

            // Delta
            const finalDeltaX = newX - u.x;
            const finalDeltaY = newY - u.y;

            // Collision
            let valid = true;
            const testRect = { x: newX, y: newY, width: currentW, depth: currentD, rotation: currentRot };
            const poly = getCorners(testRect);
            if (walls.some(w => polygonsIntersect(poly, w))) valid = false;
            for (const obs of validObstacles) {
                if (polygonsIntersect(poly, getCorners({ ...obs, width: obs.width, depth: obs.depth, rotation: obs.rotation }))) {
                    valid = false; break;
                }
            }

            // Use synchronous ref instead of state to ensure we have groupIds
            // const groupIds = dragMeta.current.groupIds;

            setDragState({
                id: u.id, x: newX, y: newY, rot: currentRot, valid, w: currentW, d: currentD,
                groupIds,
                deltaX: finalDeltaX,
                deltaY: finalDeltaY
            });

            if (last) {
                setSnapLines([]);
                // Allow commit even if invalid (User Override)
                // if (valid) {
                // Update Leader
                const updates = [{ ...u, x: newX, y: newY }];
                // Update Followers
                groupIds.forEach(gid => {
                    if (gid !== u.id && allObjects[gid]) {
                        updates.push({ ...allObjects[gid], x: allObjects[gid].x + finalDeltaX, y: allObjects[gid].y + finalDeltaY });
                    }
                });
                onUpdate(updates);
                // }
                setDragState(null);
                setInteractionMode(null);
                setTimeout(() => { hasDragged.current = false; }, 0);
            }
        }
    }, {
        drag: { filterTaps: true, threshold: 5 },
        eventOptions: { passive: false }
    });


    // --- RESIZE LOGIC ---
    // --- RESIZE LOGIC ---
    const bindResize = useGesture({
        onDragStart: ({ event }) => {
            event.stopPropagation();
            onSelectLocation(u.id);
            setInteractionMode('resize');
        },
        onDrag: ({ event, delta: [dx, dy], last, args: [handleType] }) => {
            event.stopPropagation();
            const isAlt = event.altKey;
            const isShift = event.shiftKey;

            const rad = (currentRot * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            const dLocalX = (dx * cos + dy * sin) / SCALE; // User Depth
            const dLocalY = (-dx * sin + dy * cos) / SCALE; // User Width

            let mD = 0; if (handleType.includes('R')) mD = 1; else mD = -1;
            let mW = 0; if (handleType.includes('B')) mW = 1; else mW = -1;

            let changeD = dLocalX * mD;
            let changeW = dLocalY * mW;

            let newD, newW, newCX, newCY;

            if (u.tipo === 'estanteria_modulo') {
                // MODULAR RESIZING FOR SHELVES
                // Lock Depth
                changeD = 0;
                newD = SHELF_DEPTH; // Force Standard Depth

                // Snap Width to Modules
                let rawW = currentW + changeW;
                if (isAlt) rawW = currentW + changeW * 2;

                // Snap to nearest module
                let modules = Math.round(rawW / SHELF_MODULE_WIDTH);
                if (modules < 1) modules = 1;
                newW = modules * SHELF_MODULE_WIDTH;

                // Recalculate Change to apply shift
                const finalChangeW = newW - currentW;

                if (isAlt) {
                    newCX = currentX; newCY = currentY;
                } else {
                    const shiftLocalW = (finalChangeW / 2) * mW;
                    const svgShiftX = -shiftLocalW * SCALE * sin;
                    const svgShiftY = shiftLocalW * SCALE * cos;
                    newCX = currentX + (svgShiftY / SCALE);
                    newCY = currentY + (svgShiftX / SCALE);
                }

            } else {
                // STANDARD RESIZING
                if (isShift) {
                    const ratio = u.width / u.depth;
                    if (Math.abs(changeD) > Math.abs(changeW)) changeW = changeD * ratio;
                    else changeD = changeW / ratio;
                }

                if (isAlt) {
                    newD = Math.max(0.4, currentD + changeD * 2);
                    newW = Math.max(0.4, currentW + changeW * 2);
                    newCX = currentX; newCY = currentY;
                } else {
                    newD = Math.max(0.4, currentD + changeD);
                    newW = Math.max(0.4, currentW + changeW);

                    const realChangeD = newD - currentD;
                    const realChangeW = newW - currentW;
                    const shiftLocalD = (realChangeD / 2) * mD;
                    const shiftLocalW = (realChangeW / 2) * mW;

                    const svgShiftX = shiftLocalD * SCALE * cos - shiftLocalW * SCALE * sin;
                    const svgShiftY = shiftLocalD * SCALE * sin + shiftLocalW * SCALE * cos;
                    const userShiftX = svgShiftY / SCALE;
                    const userShiftY = svgShiftX / SCALE;

                    newCX = currentX + userShiftX;
                    newCY = currentY + userShiftY;
                }
            }

            const valid = true; // Simplified collision for resize for now

            setDragState({ id: u.id, x: newCX, y: newCY, rot: currentRot, w: newW, d: newD, valid });

            if (last) {
                onUpdate({ ...u, x: newCX, y: newCY, width: newW, depth: newD });
                setDragState(null);
                setInteractionMode(null);
            }
        }
    });

    // --- ROTATE LOGIC (VECTOR BASED) ---
    const bindRotate = useGesture({
        onDragStart: ({ event }) => {
            event.stopPropagation();
            onSelectLocation(u.id);
            setInteractionMode('rotate');
        },
        onDrag: ({ event, xy: [x, y], last, memo }) => {
            event.stopPropagation();

            // Calculate center if not already memoized
            let center = memo;
            if (!center) {
                // Attempt to find the object group (parent of the handle)
                const target = event.target as Element;
                const groupEl = target.closest('g');

                if (groupEl) {
                    const rect = groupEl.getBoundingClientRect();
                    center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                } else {
                    // Fallback to approximate center from event? Risky.
                    // Just return 0 to avoid crash, but rotation will feel wrong.
                    center = { x: x, y: y };
                }
            }

            // Calculate angle from Object Center to Mouse
            const angleRad = Math.atan2(y - center.y, x - center.x);
            const angleDeg = angleRad * (180 / Math.PI);

            // Snapping (Shift) - Handle is at -90 degrees (Top)
            let newRot = angleDeg + 90;

            if (event.shiftKey) {
                newRot = Math.round(newRot / 15) * 15;
            }

            // Normalize
            newRot = (newRot % 360 + 360) % 360;

            setDragState({
                id: u.id, x: currentX, y: currentY, rot: newRot, w: currentW, d: currentD, valid: true
            });

            if (last) {
                onUpdate({ ...u, rotation: newRot });
                setDragState(null);
                setInteractionMode(null);
            }

            return center;
        }
    });

    // --- CLICK & LONG PRESS Handlers ---
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressed = useRef(false);
    const startClickPos = useRef({ x: 0, y: 0 }); // Track for manual click detection
    const hasDragged = useRef(false); // Restore to prevent ReferenceError in bindMove

    // Explicitly grab handlers from bindMove
    const moveHandlers = bindMove();

    const handlePointerDown = (e: React.PointerEvent) => {
        // Forward to drag handler
        moveHandlers.onPointerDown?.(e as any);
        e.stopPropagation();

        // Store Start Position for manual click check
        startClickPos.current = { x: e.clientX, y: e.clientY };

        isLongPressed.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPressed.current = true;
            onSelectLocation(u.id, { toggle: true });
        }, 600);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        moveHandlers.onPointerUp?.(e as any);
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        // RELIABLE CLICK SELECTION (Manual Distance Check)
        // If movement is < 5 pixels, treat as click.
        const dist = Math.hypot(e.clientX - startClickPos.current.x, e.clientY - startClickPos.current.y);

        if (dist < 5 && !isLongPressed.current) {
            e.stopPropagation();
            const isCtrl = e.ctrlKey || e.metaKey;
            const isShift = e.shiftKey;
            onSelectLocation(u.id, { toggle: isCtrl, range: isShift });
        }
    };

    const handlePointerCancel = (e: React.PointerEvent) => {
        // @ts-ignore
        moveHandlers.onPointerCancel?.(e as any);
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Handled in PointerUp
    };

    // VISUAL RENDERING
    const renderVisuals = () => {
        let content;
        if (u.tipo === 'estanteria_modulo') {
            const uprightW = Math.max(3, 0.08 * SCALE);
            const numModules = Math.round(u.width / SHELF_MODULE_WIDTH);

            // Dividers: Orientation depends on Rotation Mode
            const dividers = [];
            for (let i = 1; i < numModules; i++) {
                if (rotationMode === 'vertical-ccw') {
                    // Vertical Mode: Length is along X (finalSvgW). Dividers are Vertical lines.
                    const xPos = -finalSvgW / 2 + (i * SHELF_MODULE_WIDTH * SCALE);
                    dividers.push(
                        <rect key={i} x={xPos - 1} y={-finalSvgH / 2} width={2} height={finalSvgH} fill="black" />
                    );
                } else {
                    // Horizontal Mode: Length is along Y (finalSvgH). Dividers are Horizontal lines.
                    const yPos = -finalSvgH / 2 + (i * SHELF_MODULE_WIDTH * SCALE);
                    dividers.push(
                        <rect key={i} x={-finalSvgW / 2} y={yPos - 1} width={finalSvgW} height={2} fill="black" />
                    );
                }
            }

            content = (
                <g>
                    {/* Shadow for Depth */}
                    <rect x={-finalSvgW / 2 + 3} y={-finalSvgH / 2 + 3} width={finalSvgW} height={finalSvgH} fill="rgba(0,0,0,0.2)" rx={2} />

                    {/* Selection Glow (Outer Ring) */}
                    {isSelected && <rect x={-finalSvgW / 2 - 2} y={-finalSvgH / 2 - 2} width={finalSvgW + 4} height={finalSvgH + 4} fill="none" stroke="#00E5FF" strokeWidth={3} rx={2} />}

                    {/* Main Body - Industrial Blue Grey */}
                    <rect
                        x={-finalSvgW / 2}
                        y={-finalSvgH / 2}
                        width={finalSvgW}
                        height={finalSvgH}
                        fill={isValid ? "#cfd8dc" : "#ffebee"}
                        stroke={isValid ? "#546e7a" : "red"}
                        strokeWidth={2}
                        rx={2}
                    />

                    {/* Ends (Uprights) - Distinct Visuals */}
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={uprightW} fill="#455a64" rx={1} />
                    <rect x={-finalSvgW / 2} y={finalSvgH / 2 - uprightW} width={finalSvgW} height={uprightW} fill="#455a64" rx={1} />

                    {/* Internal Dividers */}
                    {dividers}

                    {/* Text: Rotated for Readability with background Pill for contrast */}
                    <g transform={`rotate(${-currentRot})`}>
                        {/* Green Pill matching Corporate Colors */}
                        <rect x={-20} y={-9} width={40} height={18} rx={4} fill="#007a33" stroke="#004d20" strokeWidth={1} />
                        <text x={0} y={0} fontSize={11} fontWeight="700" fill="#ffffff" textAnchor="middle" dy="0.35em" style={{ userSelect: 'none', pointerEvents: 'none' }}>{u.contenido}</text>
                    </g>
                </g>
            );
        } else if (u.tipo === 'zona_carga') { // Van (Detailed Visuals)
            // Determine orientation based on aspect ratio
            const isHorizontal = finalSvgW > finalSvgH;
            const L = isHorizontal ? finalSvgW : finalSvgH; // Length
            const W = isHorizontal ? finalSvgH : finalSvgW; // Width

            // Assume Front is usually "Right" (+X) if Horizontal, or "Bottom" (+Y) if Vertical (in Local Space)
            // We'll organize logic relative to a "Standard Horizontal" frame and rotate if needed?
            // Actually, easier to just draw based on `isHorizontal`.

            // Colors
            const bodyColor = "#cfd8dc"; // Grey Blue
            const cabinColor = "#cfd8dc"; // Grey Blue
            const glassColor = "#0277bd"; // Darker Blue
            const wheelColor = "#263238"; // Dark Grey

            // Rotation Fix for Vertical Mode:
            // User wants Van to face Door (Top/Up). 
            // - Up on Screen = -90 degrees in SVG space.
            // - Current Physical Rotation = currentRot (e.g. 94 deg, Down).
            // - We need Net Rotation = -90.
            // - So Inner Rotation = -90 - currentRot.
            // - Note: We add this to the Parent transform which is +currentRot.
            // - Net = currentRot + (-90 - currentRot) = -90.
            const visualRot = (rotationMode === 'vertical-ccw') ? (-90 - currentRot) : 0;

            // Note: finalRot var is unused, removing it.

            content = (
                <g transform={`rotate(${visualRot})`}>
                    {/* Selection Highlight */}
                    {isSelected && <rect x={-finalSvgW / 2 - 4} y={-finalSvgH / 2 - 4} width={finalSvgW + 8} height={finalSvgH + 8} fill="none" stroke="#00E5FF" strokeWidth={3} rx={8} />}

                    {/* WHEELS (4x) - Draw before body */}
                    {isHorizontal ? (
                        <>
                            {/* Front-Top, Front-Bottom, Rear-Top, Rear-Bottom */}
                            <rect x={L / 2 - L * 0.15} y={-W / 2 - 4} width={L * 0.12} height={6} fill={wheelColor} rx={2} />
                            <rect x={L / 2 - L * 0.15} y={W / 2 - 2} width={L * 0.12} height={6} fill={wheelColor} rx={2} />
                            <rect x={-L / 2 + L * 0.05} y={-W / 2 - 4} width={L * 0.12} height={6} fill={wheelColor} rx={2} />
                            <rect x={-L / 2 + L * 0.05} y={W / 2 - 2} width={L * 0.12} height={6} fill={wheelColor} rx={2} />
                        </>
                    ) : (
                        <>
                            {/* Vertical Orientation (Front=Top, facing Door) */}
                            {/* Front Wheels (Top) */}
                            <rect x={-W / 2 - 4} y={-L / 2 + L * 0.15} width={6} height={L * 0.12} fill={wheelColor} rx={2} />
                            <rect x={W / 2 - 2} y={-L / 2 + L * 0.15} width={6} height={L * 0.12} fill={wheelColor} rx={2} />
                            {/* Rear Wheels (Bottom) */}
                            <rect x={-W / 2 - 4} y={L / 2 - L * 0.05 - L * 0.12} width={6} height={L * 0.12} fill={wheelColor} rx={2} />
                            <rect x={W / 2 - 2} y={L / 2 - L * 0.05 - L * 0.12} width={6} height={L * 0.12} fill={wheelColor} rx={2} />
                        </>
                    )}

                    {/* MAIN BODY */}
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill={bodyColor} stroke="#546e7a" strokeWidth={1} rx={4} />

                    {/* CABIN / HOOD */}
                    {isHorizontal ? (
                        // Horizontal: Hood at Right (+X)
                        <path d={`
                            M ${L / 2 - L * 0.25} ${-W / 2} 
                            L ${L / 2 - 4} ${-W / 2} 
                            Q ${L / 2} ${-W / 2} ${L / 2} ${-W / 2 + 4} 
                            L ${L / 2} ${W / 2 - 4} 
                            Q ${L / 2} ${W / 2} ${L / 2 - 4} ${W / 2}
                            L ${L / 2 - L * 0.25} ${W / 2} 
                            Z
                        `} fill={cabinColor} stroke="none" />
                    ) : (
                        // Vertical: Hood at Top (-Y, facing Door)
                        <path d={`
                            M ${-W / 2} ${-L / 2 + L * 0.25}
                            L ${-W / 2} ${-L / 2 + 4}
                            Q ${-W / 2} ${-L / 2} ${-W / 2 + 4} ${-L / 2}
                            L ${W / 2 - 4} ${-L / 2}
                            Q ${W / 2} ${-L / 2} ${W / 2} ${-L / 2 + 4}
                            L ${W / 2} ${-L / 2 + L * 0.25}
                            Z
                        `} fill={cabinColor} stroke="none" />
                    )}

                    {/* WINDSHIELD */}
                    {isHorizontal ? (
                        <rect x={L / 2 - L * 0.24} y={-W / 2 + 3} width={L * 0.08} height={W - 6} fill={glassColor} rx={1} />
                    ) : (
                        // Vertical: Top
                        <rect x={-W / 2 + 3} y={-L / 2 + L * 0.24 - L * 0.08} width={W - 6} height={L * 0.08} fill={glassColor} rx={1} />
                    )}

                    {/* HEADLIGHTS (Yellow) */}
                    {isHorizontal ? (
                        <>
                            <circle cx={L / 2} cy={-W / 2 + W * 0.2} r={3} fill="#ffeb3b" stroke="#fbc02d" strokeWidth={1} />
                            <circle cx={L / 2} cy={W / 2 - W * 0.2} r={3} fill="#ffeb3b" stroke="#fbc02d" strokeWidth={1} />
                        </>
                    ) : (
                        // Vertical: Top
                        <>
                            <circle cx={-W / 2 + W * 0.2} cy={-L / 2} r={3} fill="#ffeb3b" stroke="#fbc02d" strokeWidth={1} />
                            <circle cx={W / 2 - W * 0.2} cy={-L / 2} r={3} fill="#ffeb3b" stroke="#fbc02d" strokeWidth={1} />
                        </>
                    )}

                    {/* SIDE MIRRORS */}
                    {isHorizontal ? (
                        <>
                            <rect x={L / 2 - L * 0.24} y={-W / 2 - 6} width={4} height={6} fill={bodyColor} stroke="#455a64" strokeWidth={1} rx={1} />
                            <rect x={L / 2 - L * 0.24} y={W / 2} width={4} height={6} fill={bodyColor} stroke="#455a64" strokeWidth={1} rx={1} />
                        </>
                    ) : (
                        // Vertical: Top
                        <>
                            <rect x={-W / 2 - 6} y={-L / 2 + L * 0.24 - 4} width={6} height={4} fill={bodyColor} stroke="#455a64" strokeWidth={1} rx={1} />
                            <rect x={W / 2} y={-L / 2 + L * 0.24 - 4} width={6} height={4} fill={bodyColor} stroke="#455a64" strokeWidth={1} rx={1} />
                        </>
                    )}

                    <text x={0} y={0} fontSize={10} fontWeight="bold" fill="#37474f" textAnchor="middle" dy="0.3em" transform={`rotate(${-currentRot})`} style={{ pointerEvents: 'none', textShadow: '0px 1px 1px rgba(255,255,255,0.5)' }}>FURGONETA</text>
                </g>
            );
        } else if (u.tipo === 'puerta') {
            const isVertical = finalSvgH > finalSvgW;
            const r = isVertical ? finalSvgH / 2 : finalSvgW / 2;
            const strokeColor = isSelected ? "#00E5FF" : "#333";
            const strokeW = isSelected ? 3 : 1;
            const arcColor = "#2196F3";

            if (isVertical) {
                // Vertical Door (Long along Y) - Open to Left (-X)
                content = (
                    <g>
                        <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="none" stroke={strokeColor} strokeWidth={strokeW} />
                        {/* Leaf 1 (Top) */}
                        <line x1={0} y1={-finalSvgH / 2} x2={-r} y2={-finalSvgH / 2} stroke={strokeColor} strokeWidth={3} />
                        <path d={`M ${-r} ${-finalSvgH / 2} A ${r} ${r} 0 0 0 ${0} ${0}`} fill="none" stroke={arcColor} strokeWidth={2} strokeDasharray="4,2" />
                        {/* Leaf 2 (Bottom) */}
                        <line x1={0} y1={finalSvgH / 2} x2={-r} y2={finalSvgH / 2} stroke={strokeColor} strokeWidth={3} />
                        <path d={`M ${-r} ${finalSvgH / 2} A ${r} ${r} 0 0 1 ${0} ${0}`} fill="none" stroke={arcColor} strokeWidth={2} strokeDasharray="4,2" />

                        <text x={r} y={0} fontSize={10} fill="#333" textAnchor="middle" transform={`rotate(${-currentRot})`} style={{ pointerEvents: 'none' }}>{u.contenido}</text>
                    </g>
                );
            } else {
                // Horizontal Door (Long along X)
                const rH = finalSvgW / 2;

                // Explicitly define Leaf Endpoint (Y coordinate relative to center)
                // Normal Mode (Top Wall): Opens UP (Outside) -> Negative Y.
                // Vertical-CCW Mode (Top Wall): Opens DOWN (Inside) -> Positive Y.

                const isVerticalMode = rotationMode === 'vertical-ccw';
                const leafEnd = isVerticalMode ? rH : -rH;
                const textPos = isVerticalMode ? (rH + 15) : -(rH + 15);

                // Arc Sweep Logic:
                // If going to Positive Y (Vertical Mode), we need Sweep 0?
                // Test: Start (-W/2, +H). End (-W/2, 0). 
                // Wait. Path logic:
                // M ${-finalSvgW / 2} ${leafEnd} A ... 0 0.

                const arcSweep1 = isVerticalMode ? 0 : 1;
                const arcSweep2 = isVerticalMode ? 1 : 0;

                content = (
                    <g>
                        <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="none" stroke={strokeColor} strokeWidth={strokeW} />
                        {/* Leaf 1 (Left) */}
                        <line x1={-finalSvgW / 2} y1={0} x2={-finalSvgW / 2} y2={leafEnd} stroke={strokeColor} strokeWidth={3} />
                        <path d={`M ${-finalSvgW / 2} ${leafEnd} A ${rH} ${rH} 0 0 ${arcSweep1} ${0} ${0}`} fill="none" stroke={arcColor} strokeWidth={2} strokeDasharray="4,2" />
                        {/* Leaf 2 (Right) */}
                        <line x1={finalSvgW / 2} y1={0} x2={finalSvgW / 2} y2={leafEnd} stroke={strokeColor} strokeWidth={3} />
                        <path d={`M ${finalSvgW / 2} ${leafEnd} A ${rH} ${rH} 0 0 ${arcSweep2} ${0} ${0}`} fill="none" stroke={arcColor} strokeWidth={2} strokeDasharray="4,2" />

                        <text x={0} y={textPos} fontSize={10} fill="#333" textAnchor="middle" transform={`rotate(${-currentRot})`} style={{ pointerEvents: 'none' }}>{u.contenido}</text>
                    </g>
                );
            }
        } else if (u.tipo === 'muro') {
            content = (
                <g>
                    {/* SOLID WALL with Shadow */}
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="#374151" stroke="none" filter="url(#wall-shadow)" />
                </g>
            );
        } else { // Pallet
            content = (
                <g>
                    {isSelected && <rect x={-finalSvgW / 2 - 6} y={-finalSvgH / 2 - 6} width={finalSvgW + 12} height={finalSvgH + 12} fill="none" stroke="#00E5FF" strokeWidth={5} rx={4} />}

                    {/* Base Color */}
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill={color} stroke={stroke} strokeWidth={1} fillOpacity={isDragging ? 0.8 : 1} rx={2} />

                    {/* Texture Overlay */}
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="url(#box-texture)" pointerEvents="none" opacity="0.4" rx={2} />

                    {/* Text Label - Always Horizontal */}
                    <g transform={`rotate(${-currentRot})`}>
                        <text x={0} y={0} fontSize={10} textAnchor="middle" dy="0.3em" fill="#000" pointerEvents="none">{u.id}</text>
                        {u.cantidad && u.cantidad > 0 && <text x={0} y={10} fontSize={8} fill="black" fontWeight="bold" pointerEvents="none" textAnchor="middle">x{u.cantidad}</text>}
                    </g>
                </g>
            );
        }
        return content;
    };

    return (
        <g id={`obj-${u.id}`} data-id={u.id} transform={`translate(${s.x}, ${s.y}) rotate(${currentRot})`} style={{ touchAction: 'none' }}>
            {/* Main Body with Gestures */}
            <g
                {...moveHandlers}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onClick={handleClick}
                style={{ cursor: interactionMode === 'resize' ? 'crosshair' : 'pointer', touchAction: 'none' }}
            >
                {renderVisuals()}
            </g>

            {/* HANDLES UI */}
            {isSelected && (
                <>
                    {/* Corners */}
                    <circle key="TL" {...bindResize("TL")} cx={-finalSvgW / 2} cy={-finalSvgH / 2} r={5} fill="white" stroke="#2196F3" strokeWidth={2} style={{ cursor: "nw-resize" }} />
                    <circle key="TR" {...bindResize("TR")} cx={finalSvgW / 2} cy={-finalSvgH / 2} r={5} fill="white" stroke="#2196F3" strokeWidth={2} style={{ cursor: "ne-resize" }} />
                    <circle key="BL" {...bindResize("BL")} cx={-finalSvgW / 2} cy={finalSvgH / 2} r={5} fill="white" stroke="#2196F3" strokeWidth={2} style={{ cursor: "sw-resize" }} />
                    <circle key="BR" {...bindResize("BR")} cx={finalSvgW / 2} cy={finalSvgH / 2} r={5} fill="white" stroke="#2196F3" strokeWidth={2} style={{ cursor: "se-resize" }} />

                    {/* Rotate Gizmo */}
                    <g transform={`translate(0, ${-finalSvgH / 2 - 20})`} style={{ cursor: 'grab' }} {...bindRotate()} >
                        <circle cx={0} cy={0} r={5} fill="#2196F3" />
                    </g>
                </>
            )}
        </g>
    );
};

// Simple Grid Component (Removed: unused)
// const Grid: React.FC<{ width: number, height: number, scale: number }> = ({ width, height, scale }) => { ... };

const WarehouseMap = forwardRef((props: WarehouseMapProps, ref: React.ForwardedRef<WarehouseMapRef>) => {
    const {
        ubicaciones, onSelectLocation, selectedIds, onUpdate, geometry, onUpdateGeometry,
        onSelectMultiple, rotationMode = 'normal', showGrid = false, programColors = {}
    } = props;
    // Local state for dragging visualizer (optimistic UI)
    const [dragState, setDragState] = useState<{ id: string, x: number, y: number, rot: number, valid: boolean, w?: number, d?: number, groupIds?: string[], deltaX?: number, deltaY?: number } | null>(null);

    // Snapping Lines State
    const [snapLines, setSnapLines] = useState<SnapLine[]>([]);

    // Viewport State (Pan & Zoom) - Hardcoded User Preference (Portrait vs Landscape)
    const [view, setView] = useState(() => {
        if (rotationMode === 'vertical-ccw') {
            return { x: 292, y: -11, k: 0.908 };
        } else {
            return { x: 249, y: 78, k: 1.331 };
        }
    });

    // Update view when rotationMode changes to match user preferences
    React.useEffect(() => {
        if (rotationMode === 'vertical-ccw') {
            setView({ x: 292, y: -11, k: 0.908 });
        } else {
            setView({ x: 249, y: 78, k: 1.331 });
        }
    }, [rotationMode]);

    // Coordinate Transform: User(x,y) -> SVG(svgX, svgY)
    // svgX = y * SCALE
    // svgY = x * SCALE
    // Coordinate Transform: 
    // Normal: svgX = y * SCALE, svgY = x * SCALE (Old Warehouse Logic: X=Vertical on screen)
    // Vertical-CCW (-90): Swap axes?
    // Let's deduce:
    // Normal: (uX, uY) -> (uY * SCALE, uX * SCALE) -> (ScreenX, ScreenY)
    // Vertical CCW: Top of warehouse is now LEFT of screen.
    // ScreenX = uX * SCALE
    // ScreenY = -uY * SCALE (flipping axis?)

    // Actually simpler: Rotate the point (svgX, svgY) by -90 around center? 
    // No, we want the whole coordinate system to be rotated.

    const toSVG = (uX: number, uY: number) => {
        if (rotationMode === 'vertical-ccw') {
            // ... (rest of toSVG implementation) ...
            return { x: uX * SCALE, y: (29 - uY) * SCALE };
        }
        return { x: uY * SCALE, y: uX * SCALE };
    };

    useImperativeHandle(ref, () => ({
        getViewCenter: () => {
            // ...
            // Let's use window center as default "Center of View"
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;

            const svgX = (cx - view.x) / view.k;
            const svgY = (cy - view.y) / view.k;

            return { x: svgY / SCALE, y: svgX / SCALE };
        }
    }));

    // --- VIEWPORT GESTURES & SELECTION ---
    const bindView = useGesture({
        onDragStart: ({ event }) => {
            // Prevent default browser drag behaviors
            if (event.cancelable) event.preventDefault();
        },
        onDrag: ({ event, first, last, xy: [x, y], memo, offset: [ox, oy] }) => {
            const isShift = event.shiftKey;

            if (isShift) {
                // Area Selection Mode
                const svg = (event.target as Element).closest('svg');
                if (!svg) return;

                const rect = svg.getBoundingClientRect();
                // Calculate Mouse Pos in "SVG World Space" (pixels, but zoom/pan corrected)
                // Use 'x' and 'y' from gesture state which are client coordinates
                const worldX = (x - rect.left - view.x) / view.k;
                const worldY = (y - rect.top - view.y) / view.k;

                if (first) {
                    const newBox = { startX: worldX, startY: worldY, currentX: worldX, currentY: worldY };
                    setSelectionBox(newBox);
                    return { startX: worldX, startY: worldY, box: newBox };
                }

                if (memo) {
                    const { startX, startY } = memo;
                    const newBox = { startX, startY, currentX: worldX, currentY: worldY };
                    setSelectionBox(newBox);

                    if (last) {
                        // Finalize Selection
                        const minX = Math.min(newBox.startX, newBox.currentX);
                        const maxX = Math.max(newBox.startX, newBox.currentX);
                        const minY = Math.min(newBox.startY, newBox.currentY);
                        const maxY = Math.max(newBox.startY, newBox.currentY);

                        const selectionPoly = [
                            { x: minX, y: minY },
                            { x: maxX, y: minY },
                            { x: maxX, y: maxY },
                            { x: minX, y: maxY }
                        ];

                        const newSelectedIds: string[] = [];

                        Object.values(ubicaciones).forEach(u => {
                            const s = toSVG(u.x, u.y);
                            // SVG Dimensions (User Depth -> SVG Width, User Width -> SVG Height)
                            const sw = u.depth * SCALE;
                            const sh = u.width * SCALE;

                            // Get corners of the object (Rotated)
                            const objPoly = getCorners({
                                x: s.x,
                                y: s.y,
                                width: sw,
                                depth: sh,
                                rotation: u.rotation
                            });

                            if (polygonsIntersect(selectionPoly, objPoly)) {
                                newSelectedIds.push(u.id);
                            }
                        });


                        if (onSelectMultiple) {
                            onSelectMultiple(newSelectedIds);
                        }
                        setSelectionBox(null);
                    }
                    return memo;
                }
            }

            // Standard Pan (only if not selecting)
            if (!isShift) {
                if (first) return { initialView: { ...view } };
                // Calculate delta from initial drag
                // We use memo to store initial state? Or just accumulate?
                // useGesture 'offset' tracks total movement. 'movement' tracks gesture movement.
                // Standard pan: view.x = startView.x + mx

                // Correct usage with 'from':
                // Use 'offset' which tracks the value starting from 'from'.
                setView(v => ({ ...v, x: ox, y: oy }));
            }
        },
        onPinch: ({ offset: [k], memo }) => {
            setView(v => ({ ...v, k }));
            return memo;
        }
    }, {
        drag: { from: () => [view.x, view.y], filterTaps: true },
        pinch: { scaleBounds: { min: 0.1, max: 5 }, rubberband: true, from: () => [view.k, 0] }
    });

    // Better Zoom Logic (Wheel)
    useGesture({
        onWheel: ({ event, delta: [, dy], ctrlKey }) => {
            if (ctrlKey || event.metaKey) {
                event.preventDefault();
                const s = Math.exp(-dy * 0.001);
                setView(v => ({ ...v, k: Math.max(0.1, Math.min(5, v.k * s)) }));
            } else {
                setView(v => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
            }
        }
    }, {
        target: window,
        eventOptions: { passive: false }
    });


    // --- GEOMETRY EDITING ---
    const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
    const [showGeoPoints] = useState(false);

    // Calculate Dynamic Walls for Collision
    const currentWalls = React.useMemo(() => generateWallsFromFloor(geometry), [geometry]);

    const bindGeoPoint = useGesture({
        onDragStart: ({ args: [index], event }) => {
            event.stopPropagation();
            setEditingPointIndex(index);
        },
        onDrag: ({ args: [index], delta: [dx, dy], event }) => {
            event.stopPropagation();

            let dXUser = 0;
            let dYUser = 0;

            if (rotationMode === 'vertical-ccw') {
                // Vertical Mode Logic (Same as Objects)
                dXUser = dx / SCALE;
                dYUser = -dy / SCALE;
            } else {
                // Horizontal Mode
                dXUser = dy / SCALE;
                dYUser = dx / SCALE;
            }

            const newGeo = [...geometry];
            newGeo[index] = {
                x: newGeo[index].x + dXUser,
                y: newGeo[index].y + dYUser
            };
            onUpdateGeometry(newGeo);
        },
        onDragEnd: () => {
            setEditingPointIndex(null);
        }
    });



    // Render Floor Polygon
    const renderFloor = () => {
        if (!geometry || geometry.length < 3) return null;

        const pathData = geometry.map((p, i) => {
            const s = toSVG(p.x, p.y);
            return `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
        }).join(' ') + ' Z';

        return (
            <>
                {/* 1. White Background */}
                <path d={pathData} fill="#f2f2f2" stroke="#222" strokeWidth="5" strokeLinejoin="round" />

                {/* 2. Grid Overlay (Clipped to Floor) */}
                {showGrid && (
                    <path d={pathData} fill="url(#grid-large)" stroke="none" style={{ pointerEvents: 'none' }} />
                )}
            </>
        );
    };

    const renderGeoControlPoints = () => {
        if (!geometry || !showGeoPoints) return null;
        return geometry.map((p, i) => {
            const s = toSVG(p.x, p.y);
            return (
                <circle
                    key={`geo-pt-${i}`}
                    cx={s.x} cy={s.y}
                    r={12}
                    fill={editingPointIndex === i ? "#1565C0" : "#2196F3"}
                    stroke="white"
                    strokeWidth={3}
                    style={{ cursor: 'move', filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))', touchAction: 'none' }}
                    {...bindGeoPoint(i)}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        // Remove point
                        if (geometry.length <= 3) return;
                        const newGeo = [...geometry];
                        newGeo.splice(i, 1);
                        onUpdateGeometry(newGeo);
                    }}
                />
            );
        });
    };

    const renderEdgeHitTargets = () => {
        if (!geometry || !showGeoPoints) return null;
        return geometry.map((p, i) => {
            const pNext = geometry[(i + 1) % geometry.length];
            const s1 = toSVG(p.x, p.y);
            const s2 = toSVG(pNext.x, pNext.y);

            return (
                <line
                    key={`edge-hit-${i}`}
                    x1={s1.x} y1={s1.y}
                    x2={s2.x} y2={s2.y}
                    stroke="transparent"
                    strokeWidth={20}
                    style={{ cursor: 'copy' }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        // Add point projected on segment
                        // Convert Mouse to User Coords
                        // e.nativeEvent.offsetX is relative to the TARGET usually, or clientX?
                        // SVG events can be tricky. Let's use getBoundingClientRect or standard conversion.
                        // Actually, easier: use the event layerX/Y (if available via bounds)
                        // Or calculate relative to the SVG root.
                        const svgRect = e.currentTarget.closest('svg')?.getBoundingClientRect();
                        if (!svgRect) return;

                        const domX = e.clientX - svgRect.left;
                        const domY = e.clientY - svgRect.top;

                        // Reverse Transform: translate(view.x, view.y) scale(view.k)
                        const localX = (domX - view.x) / view.k;
                        const localY = (domY - view.y) / view.k;

                        // Reverse toSVG: x -> uY * SCALE, y -> uX * SCALE
                        const uX = localY / SCALE;
                        const uY = localX / SCALE;

                        // Project onto segment
                        const pt = projectPointOnSegment({ x: uX, y: uY }, p, pNext);

                        const newGeo = [...geometry];
                        // Insert after i
                        newGeo.splice(i + 1, 0, pt);
                        onUpdateGeometry(newGeo);
                    }}
                />
            );
        });
    };


    // --- AREA SELECTION STATE ---
    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);

    // --- RENDERERS ---

    const renderObjects = () => {
        return Object.values(ubicaciones).map(u => {
            // Fix for Group Dragging Collision:
            // If I am being dragged (i.e. I am in selectedIds and we are dragging), 
            // I should NOT check collision against other "moving" items (items in selectedIds).
            // So 'otherObstacles' should exclude all items that are currently selected (if I am selected).

            let obstacles = Object.values(ubicaciones).filter(o => o.id !== u.id);
            if (selectedIds.has(u.id)) {
                // If I am part of the selection, don't collide with others in the selection
                obstacles = obstacles.filter(o => !selectedIds.has(o.id));
            }

            return (
                <DraggableObject
                    key={u.id}
                    u={u}
                    isSelected={selectedIds.has(u.id)}
                    dragState={dragState}
                    setDragState={setDragState}
                    onSelectLocation={onSelectLocation}
                    onUpdate={onUpdate}
                    toSVG={toSVG}
                    otherObstacles={obstacles}
                    allObjects={ubicaciones}
                    setSnapLines={setSnapLines}
                    walls={currentWalls}
                    selectedIds={selectedIds}
                    geometry={geometry}
                    zoomScale={view.k}
                    rotationMode={rotationMode}
                    programColors={programColors}
                />
            );
        });
    };

    // --- AUTO FIT ON LOAD & RESIZE ---
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!containerRef.current) return;

        // Auto-fit disabled to respect user's fixed starting position (X: 292, Y: -11, K: 0.908)
        /*
        const fitMap = () => {
             // ... existing fit logic ...
        };
        fitMap();
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(fitMap);
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
        */
    }, [rotationMode, geometry, Object.keys(ubicaciones || {}).length]);

    const viewHandlers = bindView();

    // Grid Dimensions
    // SVG Pattern units default to userSpaceOnUse for absolutes?
    // Actually, if we use patternUnits="userSpaceOnUse", it's in SVG coords.
    // 0.2 meters * SCALE = pixels. (removed unused smallGridSize)
    const sGrid = 0.2 * SCALE;
    const lGrid = 1.0 * SCALE;

    return (
        <div
            ref={containerRef}
            className={styles.mapContainer}
            style={{ width: '100%', height: '100%', background: '#e0e0e0', overflow: 'hidden', cursor: 'grab', touchAction: 'none' }}
            {...viewHandlers}
            onPointerDown={(e) => {
                // Call gesture handler first
                viewHandlers.onPointerDown?.(e as any);

                // Background Click to Deselect
                // Only if target is the SVG/Background and not an object
                if ((e.target as Element).tagName === 'svg' || (e.target as Element).id === 'bg-rect') {
                    if (onSelectLocation && (!selectedIds || selectedIds.size > 0)) {
                        onSelectLocation(null as any); // Type hack if needed, or update interface
                        if (onSelectMultiple) onSelectMultiple([]);
                    }
                }
            }}
        >
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                    onClick={() => setView(v => ({ ...v, k: Math.min(5, v.k * 1.2) }))}
                    style={{ padding: '5px 10px', cursor: 'pointer' }}
                    title="Zoom In"
                >
                    +
                </button>
                <button
                    onClick={() => setView(v => ({ ...v, k: Math.max(0.1, v.k / 1.2) }))}
                    style={{ padding: '5px 10px', cursor: 'pointer' }}
                    title="Zoom Out"
                >
                    -
                </button>
            </div>
            {/* DEBUG COORDINATES ENABLED */}
            <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px', borderRadius: '4px', fontSize: '10px', zIndex: 1000, pointerEvents: 'none' }}>
                X: {Math.round(view.x)}, Y: {Math.round(view.y)}, K: {view.k.toFixed(3)}
            </div>

            <svg
                width="100%"
                height="100%"
                style={{ touchAction: 'none' }}
            >
                <defs>
                    <pattern id="grid-small" width={sGrid} height={sGrid} patternUnits="userSpaceOnUse">
                        <path d={`M ${sGrid} 0 L 0 0 0 ${sGrid}`} fill="none" stroke="#e5e7eb" strokeWidth={1} />
                    </pattern>
                    <pattern id="grid-large" width={lGrid} height={lGrid} patternUnits="userSpaceOnUse">
                        <rect width={lGrid} height={lGrid} fill="url(#grid-small)" />
                        <path d={`M ${lGrid} 0 L 0 0 0 ${lGrid}`} fill="none" stroke="#d1d5db" strokeWidth={2} />
                    </pattern>

                    {/* PALLET TEXTURE */}
                    <pattern id="box-texture" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="8" stroke="#000" strokeWidth="2" opacity="0.1" />
                    </pattern>

                    {/* WALL SHADOW */}
                    <filter id="wall-shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.2)" />
                    </filter>
                </defs>
                <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>

                    {/* FLOOR (User Editable) */}
                    {renderFloor()}



                    {/* SNAP GUIDES */}
                    {snapLines.map((line, i) => {
                        const s = toSVG(line.x1, line.y1);
                        const e = toSVG(line.x2, line.y2);
                        return (
                            <line
                                key={i}
                                x1={s.x} y1={s.y}
                                x2={e.x} y2={e.y}
                                stroke="cyan"
                                strokeWidth="1"
                                strokeDasharray="5,5"
                                opacity="0.8"
                            />
                        );
                    })}

                    {/* ZONES & ASSETS */}
                    {renderObjects()}

                    {/* GEOMETRY CONTROL POINTS (Top Layer) */}
                    {renderEdgeHitTargets()}
                    {renderGeoControlPoints()}

                    {/* SELECTION BOX OVERLAY */}
                    {selectionBox && (
                        <rect
                            x={Math.min(selectionBox.startX, selectionBox.currentX)}
                            y={Math.min(selectionBox.startY, selectionBox.currentY)}
                            width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                            height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                            fill="rgba(33, 150, 243, 0.2)"
                            stroke="#2196F3"
                            strokeWidth={2}
                            pointerEvents="none" // Important: Don't block drag events
                        />
                    )}


                </g>
            </svg>
        </div >
    );
});

export default WarehouseMap;
