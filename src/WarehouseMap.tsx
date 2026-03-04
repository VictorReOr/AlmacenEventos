import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useGesture } from '@use-gesture/react';
import type { Ubicacion } from './types';
import styles from './WarehouseMap.module.css';
import { getCorners, polygonsIntersect, calculateSnap, generateWallsFromFloor, projectPointOnSegment } from './geometry';
import { getLotAttributes } from './utils/lotVisualizer';
import type { SnapLine } from './geometry';

// Comprobación de Reconstrucción Forzada

// Importar Datos y Hooks
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
    showGeoPoints?: boolean; // Nivel Dios: Editar Muros
    programColors?: Record<string, string>; // Optional to stay backward compatible or default
    isMobile?: boolean;
    readOnly?: boolean;
    isEditModeGlobal?: boolean; // NUEVO PROP PARA BLOQUEAR ARRASTRE
    onVisitorError?: () => void;
}

export interface WarehouseMapRef {
    getViewCenter: () => { x: number, y: number };
}

const SCALE = 35; // px por metro
const SHELF_MODULE_WIDTH = 1.0; // Corrección estática del ancho de módulo
const SHELF_DEPTH = 0.45;       // Corrección estática de la profundidad

// --- COMPONENTE DE INTERACCIÓN ---

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
    isMobile: boolean;
    readOnly?: boolean;
    isEditModeGlobal?: boolean; // NUEVO PROP PARA BLOQUEAR ARRASTRE
    onVisitorError?: () => void;
}

const DraggableObject: React.FC<DraggablePalletProps & { isMobile: boolean, readOnly?: boolean }> = ({ u, isSelected, dragState, setDragState, onSelectLocation, onUpdate, toSVG, otherObstacles, allObjects, setSnapLines, walls, selectedIds, geometry, zoomScale, rotationMode = 'normal', programColors, isMobile, readOnly, isEditModeGlobal, onVisitorError }) => {


    const isLeaderDragging = dragState?.id === u.id;
    const isGroupDragging = dragState?.groupIds?.includes(u.id);

    const isDragging = isLeaderDragging || isGroupDragging;

    // DIAGNÓSTICO: Rastrear Renderizados
    // console.log(`🎨 Render Object: ${u.id} (${u.tipo})`);

    // Modo de Interacción Local
    const [interactionMode, setInteractionMode] = useState<'move' | 'resize' | 'rotate' | 'move-label' | null>(null);

    // Estado Actual (Visual)
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
    // const color = isValid ? (programColors[u.programa] || '#999') : '#ff4444';

    // const stroke = isSelected ? '#2196F3' : '#333';

    // --- GESTO DE MOVER CON AJUSTE MAGNÉTICO (SNAPPING) ---
    const rawPos = useRef({ x: u.x, y: u.y }); // Rastrea la posición en bruto, sin imantar
    const dragMeta = useRef({ groupIds: [] as string[] }); // Almacenamiento síncrono para la sesión de arrastre
    const selectionHandled = useRef(false); // Corrección para el error de disparo doble (double-fire)

    const bindMove = useGesture({
        onDragStart: ({ event, cancel }) => {
            // RESTRICCIÓN: LA FURGONETA SOLO PUEDE SER MOVIDA POR ADMIN
            // RESTRICCIÓN: LA FURGONETA ES INAMOVIBLE
            if (u.id === 'van_v3' || u.tipo === 'zona_carga') {
                cancel();
                return;
            }

            event.stopPropagation();
            hasDragged.current = false;
            selectionHandled.current = false;
            // console.log('Drag Start', u.id, 'Selected:', isSelected, 'SelectedIds:', Array.from(selectedIds));
            if (!isSelected) {
                const isCtrl = (event as any).ctrlKey || (event as any).metaKey;
                const isShift = (event as any).shiftKey;
                onSelectLocation(u.id, { toggle: isCtrl, range: isShift });
                selectionHandled.current = true;
            }

            // NUEVO PROP: Bloqueo Global de Edición para Administradores
            if (readOnly || !isEditModeGlobal) {
                // RETORNO SILENCIOSO: El usuario podría estar tocando sin mucha precisión o el mapa está bloqueado para arraste.
                // Ya hemos seleccionado el artículo arriba para el panel derecho. Simplemente detenemos el arrastre.
                cancel();
                return;
            }

            setInteractionMode('move');
            rawPos.current = { x: u.x, y: u.y };

            // Lógica de Arrastre en Grupo:
            let groupIds: string[] = [];
            if (isSelected) {
                groupIds = Array.from(selectedIds);
            } else {
                groupIds = [u.id];
            }
            // console.log('GroupIds for drag:', groupIds);

            // Almacenar de forma síncrona para onDrag
            dragMeta.current.groupIds = groupIds;

            setDragState({
                id: u.id, x: u.x, y: u.y, rot: u.rotation, valid: true, w: u.width, d: u.depth,
                groupIds, deltaX: 0, deltaY: 0
            });
        },
        onDrag: ({ pinching, cancel, event, last, delta: [dx, dy] }) => {
            // Bloquear Estanterías (Prevenir arrastre) -> DESHABILITADO: El usuario quiere mover estanterías
            /*
            if (u.tipo === 'estanteria_modulo') {
                return cancel();
            }
            */

            if (u.id === 'van_v3' || u.tipo === 'zona_carga') return cancel();
            if (readOnly || !isEditModeGlobal) return cancel();
            if (pinching) return cancel();
            event.stopPropagation();
            hasDragged.current = true;

            let uDx = 0;
            let uDy = 0;

            if (rotationMode === 'vertical-ccw') {
                // Modo Vertical:
                // Pantalla X (dx) -> Usuario X (Ancho)
                // Pantalla Y (dy) -> Usuario Y (Largo) ESTÁ INVERTIDO
                // toSVG: yScreen = (29 - uY) * S.
                // dy = S * -duY => duY = -dy / S.
                // dx = S * duX => duX = dx / S.

                uDx = dx / SCALE / zoomScale;
                uDy = -dy / SCALE / zoomScale;
            } else {
                // Modo Horizontal (Original):
                // Usuario X (Altura del SVG) -> Pantalla Y
                // Usuario Y (Ancho del SVG) -> Pantalla X
                uDx = dy / SCALE / zoomScale;
                uDy = dx / SCALE / zoomScale;
            }

            // console.log('Dragging', u.id, dx, dy, uDx, uDy);

            rawPos.current.x += uDx;
            rawPos.current.y += uDy;

            let newX = rawPos.current.x;
            let newY = rawPos.current.y;

            // Usamos ref síncrona en vez del estado para asegurar que tenemos los groupIds
            const groupIds = dragMeta.current.groupIds;

            // Filtrar obstáculos: Excluir a los miembros del grupo que arrastramos
            const validObstacles = otherObstacles.filter(o => !groupIds.includes(o.id));

            // Añadir Muros como Objetivos Magnéticos
            // Convertir segmentos de geometría en "obstáculos finos" para el ajuste (snapping)
            const wallSnaps: any[] = [];
            if (geometry && geometry.length > 2) {
                for (let i = 0; i < geometry.length; i++) {
                    const p1 = geometry[i];
                    const p2 = geometry[(i + 1) % geometry.length];

                    // Proyectar centro actual sobre el segmento del muro
                    const proj = projectPointOnSegment({ x: newX, y: newY }, p1, p2);

                    // Calcular Vector del Muro en Espacio de Usuario para la rotación
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;

                    // Ángulo en Espacio SVG (Donde se aplica la rotación)
                    const angleRad = Math.atan2(dx, dy);
                    const angleDeg = angleRad * (180 / Math.PI);

                    // Crear un "Imán de Punto" en el muro en la ubicación más cercana
                    // Esto permite al objeto pegar su borde a este punto específico del muro
                    wallSnaps.push({
                        x: proj.x, y: proj.y,
                        width: 0.001, // Parecido a un punto (Point-like)
                        depth: 0.001, // Parecido a un punto (Point-like)
                        rotation: angleDeg
                    });
                }
            }

            const isAlt = event.altKey;

            // Ajuste Magnético (Sólo para el Líder)
            let snappedX = newX;
            let snappedY = newY;
            let lines: SnapLine[] = [];

            if (!isAlt) {
                const isShelf = u.tipo === 'estanteria_modulo';
                // Si es Estantería, Deshabilita TODO el ajuste (El usuario quiere control total)
                const snapTargets: any[] = isShelf
                    ? []
                    : [...validObstacles.map(o => ({ x: o.x, y: o.y, width: o.width, depth: o.depth, rotation: o.rotation })), ...wallSnaps];

                const snapResult = calculateSnap(
                    newX, newY, currentW, currentD, currentRot,
                    snapTargets,
                    isShelf // Ignorar holgura (gap) para Estanterías
                );
                snappedX = snapResult.x;
                snappedY = snapResult.y;
                lines = snapResult.lines;

                // Auto-Rotar para coincidir con el Objetivo Magnético (ej. Muro)
                if (snapResult.snappedRotation !== undefined) {
                    // ¿O siempre es válido?
                    // Asumamos que la rotación del objetivo es "correcta"
                    // Necesitamos actualizar la rotación EN ESTE FRAME para que funcione la colisión
                    // Pero currentRot es constante. Hagamos una anulación local si hiciese falta.
                }
            }

            newX = snappedX;
            newY = snappedY;
            setSnapLines(lines);

            // Variación Delta
            const finalDeltaX = newX - u.x;
            const finalDeltaY = newY - u.y;

            // Colisión
            let valid = true;
            const testRect = { x: newX, y: newY, width: currentW, depth: currentD, rotation: currentRot };
            const poly = getCorners(testRect);
            if (walls.some(w => polygonsIntersect(poly, w))) valid = false;
            for (const obs of validObstacles) {
                if (polygonsIntersect(poly, getCorners({ ...obs, width: obs.width, depth: obs.depth, rotation: obs.rotation }))) {
                    valid = false; break;
                }
            }

            // Usamos ref síncrono en vez del estado para asegurar que tenemos los groupIds
            // const groupIds = dragMeta.current.groupIds;

            setDragState({
                id: u.id, x: newX, y: newY, rot: currentRot, valid, w: currentW, d: currentD,
                groupIds,
                deltaX: finalDeltaX,
                deltaY: finalDeltaY
            });

            if (last) {
                setSnapLines([]);
                // Permitir guardar incluso si es inválido (Imposición del usuario)
                // if (valid) {
                // Actualizar Líder
                const updates = [{ ...u, x: newX, y: newY }];
                // Actualizar Seguidores
                groupIds.forEach(gid => {
                    if (gid !== u.id && allObjects[gid] && allObjects[gid].id !== 'van_v3' && allObjects[gid].tipo !== 'zona_carga') {
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
        drag: { filterTaps: true, threshold: isMobile ? 20 : 8 },
        eventOptions: { passive: false }
    });

    // --- LÓGICA DE ARRASTRE DE ETIQUETA INDEPENDIENTE ---
    const rawLabelPos = useRef({ x: u.labelX || 0, y: u.labelY || 0 });
    const [liveLabelPos, setLiveLabelPos] = useState({ x: u.labelX || 0, y: u.labelY || 0 });

    const bindLabelMove = useGesture({
        onDragStart: ({ event, cancel }) => {
            if (readOnly) return cancel();
            event.stopPropagation(); // Evitar arrastrar la estantería entera
            setInteractionMode('move-label');
            // Reset the delta accumulator for this drag session.
            // We use rawScreenDelta to prevent precision loss.
            rawLabelPos.current = { x: u.labelX || 0, y: u.labelY || 0 };
        },
        onDrag: ({ event, cancel, delta: [dx, dy] }) => {
            if (readOnly) return cancel();
            event.stopPropagation();

            // dx y dy son los píxeles reales que el ratón se movió en el monitor.
            // Paso 1: Reducir por el factor de zoom de la cámara (pan/zoom)
            const absoluteDx = dx / zoomScale;
            const absoluteDy = dy / zoomScale;

            // Paso 2: El mapa principal puede estar rotado (-90deg en vertical-ccw).
            let mapDx = absoluteDx;
            let mapDy = absoluteDy;

            if (rotationMode === 'vertical-ccw') {
                // Al rotar el mapa entero -90, los ejes de pantalla y mapa se cruzan
                mapDx = -absoluteDy;
                mapDy = absoluteDx;
            }

            // Paso 3: El objeto principal (la estantería) sobre la que vive esta etiqueta
            // tiene su propia rotación 'u.rotation' ("currentRot").
            const rad = (-currentRot * Math.PI) / 180; // Inverso porque estamos des-haciendo la rotación para encontrar el desplazamiento puro.
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            const localDx = mapDx * cos - mapDy * sin;
            const localDy = mapDx * sin + mapDy * cos;

            // Las coordenadas internas del SVG son 1 unidad de coordenada = 1 px al 100% de zoom.
            rawLabelPos.current.x += localDx;
            rawLabelPos.current.y += localDy;

            setLiveLabelPos({ x: rawLabelPos.current.x, y: rawLabelPos.current.y });
        },
        onDragEnd: ({ event }) => {
            if (readOnly) return;
            event.stopPropagation();
            setInteractionMode(null);
            onUpdate({ ...u, labelX: rawLabelPos.current.x, labelY: rawLabelPos.current.y });
        }
    }, {
        drag: { filterTaps: true, threshold: 3 },
        eventOptions: { passive: false }
    });

    // --- LÓGICA DE REDIMENSIONAMIENTO ---
    // --- LÓGICA DE REDIMENSIONAMIENTO ---
    const bindResize = useGesture({
        onDragStart: ({ event, cancel }) => {
            if (u.id === 'van_v3' || u.tipo === 'zona_carga') return cancel();
            if (readOnly || !isEditModeGlobal) {
                if (onVisitorError) onVisitorError();
                return;
            }
            event.stopPropagation();
            onSelectLocation(u.id);
            setInteractionMode('resize');
        },
        onDrag: ({ event, delta: [dx, dy], last, args: [handleType], cancel }) => {
            if (readOnly || !isEditModeGlobal) return cancel();
            event.stopPropagation();
            const isAlt = event.altKey;
            const isShift = event.shiftKey;

            const rad = (currentRot * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            const dLocalX = (dx * cos + dy * sin) / SCALE; // Profundidad de Usuario
            const dLocalY = (-dx * sin + dy * cos) / SCALE; // Ancho de Usuario

            let mD = 0; if (handleType.includes('R')) mD = 1; else mD = -1;
            let mW = 0; if (handleType.includes('B')) mW = 1; else mW = -1;

            let changeD = dLocalX * mD;
            let changeW = dLocalY * mW;

            let newD, newW, newCX, newCY;

            if (u.tipo === 'estanteria_modulo') {
                // REDIMENSIONAMIENTO MODULAR PARA ESTANTERÍAS
                // Bloquear Profundidad
                changeD = 0;
                newD = SHELF_DEPTH; // Forzar Profundidad Estándar

                // Ajustar Ancho a Módulos
                let rawW = currentW + changeW;
                if (isAlt) rawW = currentW + changeW * 2;

                // Ajustar al módulo más cercano
                let modules = Math.round(rawW / SHELF_MODULE_WIDTH);
                if (modules < 1) modules = 1;
                newW = modules * SHELF_MODULE_WIDTH;

                // Recalcular Cambio para aplicar desplazamiento
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
                // REDIMENSIONAMIENTO ESTÁNDAR
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

            const valid = true; // Colisión simplificada para redimensionamiento por ahora

            setDragState({ id: u.id, x: newCX, y: newCY, rot: currentRot, w: newW, d: newD, valid });

            if (last) {
                onUpdate({ ...u, x: newCX, y: newCY, width: newW, depth: newD });
                setDragState(null);
                setInteractionMode(null);
            }
        }
    });

    // --- LÓGICA DE ROTACIÓN (BASADA EN VECTORES) ---
    const bindRotate = useGesture({
        onDragStart: ({ event, cancel }) => {
            if (u.id === 'van_v3' || u.tipo === 'zona_carga') return cancel();
            if (readOnly || !isEditModeGlobal) {
                if (onVisitorError) onVisitorError();
                return;
            }
            event.stopPropagation();
            onSelectLocation(u.id);
            setInteractionMode('rotate');
        },
        onDrag: ({ event, xy: [x, y], last, memo, cancel }) => {
            if (readOnly || !isEditModeGlobal) return cancel();
            event.stopPropagation();

            // Calcular el centro si no está memorizado
            let center = memo;
            if (!center) {
                // Intentar encontrar el grupo del objeto (padre del tirador)
                const target = event.target as Element;
                const groupEl = target.closest('g');

                if (groupEl) {
                    const rect = groupEl.getBoundingClientRect();
                    center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                } else {
                    // ¿Alternativa de centro aproximado desde el evento? Arriesgado.
                    // Simplemente devolver 0 para evitar fallos, pero la rotación se sentirá extraña.
                    center = { x: x, y: y };
                }
            }

            // Calcular ángulo desde el Centro del Objeto hasta el Ratón
            const angleRad = Math.atan2(y - center.y, x - center.x);
            const angleDeg = angleRad * (180 / Math.PI);

            // Ajuste Magnético (Shift) - El tirador está a -90 grados (Arriba)
            let newRot = angleDeg + 90;

            if (event.shiftKey) {
                newRot = Math.round(newRot / 15) * 15;
            }

            // Normalizar
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

    // --- MANEJADORES DE CLIC Y PULSACIÓN LARGA ---
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressed = useRef(false);
    const startClickPos = useRef({ x: 0, y: 0 }); // Rastrear para la detección de clic manual
    const hasDragged = useRef(false); // Restaurar para prevenir ReferenceError en bindMove

    // Capturar explícitamente los manejadores de bindMove
    const moveHandlers = bindMove();

    const handlePointerDown = (e: React.PointerEvent) => {
        // Reenviar al manejador de arrastre
        moveHandlers.onPointerDown?.(e as any);
        e.stopPropagation();

        // Almacenar Posición de Inicio para la comprobación manual de clics
        startClickPos.current = { x: e.clientX, y: e.clientY };
        selectionHandled.current = false; // REINICIAR ESTADO EN NUEVO TOQUE

        // v1.5 SELECCIÓN INSTANTÁNEA (Solo Modo Seguro)
        // Si estamos en "readOnly" (Modo Seguro) o con edición global desactivada, seleccionar INMEDIATAMENTE al tocar.
        // Esto elimina problemas de tolerancias/tiempos y es 100% responsivo.
        if (readOnly || !isEditModeGlobal) {
            onSelectLocation(u.id);
            selectionHandled.current = true; // Mark as handled so Up/Drag don't repeat
        }

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

        // SELECCIÓN DE CLIC FIABLE (Comprobación Manual de Distancia)
        // Si el movimiento es muy leve, tratarlo como toque.
        // En móvil necesitamos MÁS tolerancia (40px) para dedos imprecisos (antes 24)
        const clickThreshold = isMobile ? 40 : 8;
        const dist = Math.hypot(e.clientX - startClickPos.current.x, e.clientY - startClickPos.current.y);

        if (isLongPressed.current) {
            // DETENER PROPAGACIÓN al soltar Pulsación Larga para evitar deselección de "Clic en Fondo"
            e.stopPropagation();
        } else if (dist < clickThreshold && !selectionHandled.current) {
            e.stopPropagation();
            // console.log('DEBUG: Clic detectado en', u.id, u.tipo); // TRACE LOG
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
        // Manejado en PointerUp
    };


    // RENDERIZADO VISUAL - ESTILO TÉCNICO ANDALUZ
    const renderVisuals = () => {
        let content;

        // REGISTRO DE DIAGNÓSTICO (¿Limitado?)
        // Para evitar saturar la consola, tal vez comprobar si es E1 o E2
        if (u.id === 'E1' || u.id === 'E2') {
            // console.log(`🖌️ Rendering ${u.id} (${u.tipo})`);
        }

        // Colores Institucionales (Hardcoded en SVG para consistencia)
        const C_VERDE = "#007A33";
        const C_GRIS_OSCURO = "#333333";
        // const C_GRIS_CLARO = "#f5f5f5";

        if (u.tipo === 'estanteria_modulo') {
            const numModules = Math.round(u.width / SHELF_MODULE_WIDTH);

            // Pestaña Superior (Estilo Carpeta)
            const TAB_THICKNESS = 6;
            const C_BG = "#FFFFFF";
            const C_STROKE = "#CFD8DC";

            // Separadores finos completos
            const dividers = [];
            for (let i = 1; i < numModules; i++) {
                if (rotationMode === 'vertical-ccw') {
                    const xPos = -finalSvgW / 2 + (i * SHELF_MODULE_WIDTH * SCALE);
                    dividers.push(<line key={`d-${i}`} x1={xPos} y1={-finalSvgH / 2 + TAB_THICKNESS} x2={xPos} y2={finalSvgH / 2} stroke="#e0e0e0" strokeWidth={1} />);
                } else {
                    const yPos = -finalSvgH / 2 + (i * SHELF_MODULE_WIDTH * SCALE);
                    dividers.push(<line key={`d-${i}`} x1={-finalSvgW / 2 + TAB_THICKNESS} y1={yPos} x2={finalSvgW / 2} y2={yPos} stroke="#e0e0e0" strokeWidth={1} />);
                }
            }

            // Lógica de Visualización de Inventario (Fichitas de color)
            const modulePrograms = new Map<number, Set<string>>();

            if (u.cajasEstanteria) {
                Object.entries(u.cajasEstanteria).forEach(([key, caja]) => {
                    const mMatch = key.match(/M(\d+)/);
                    if (mMatch && caja.programa) {
                        const mNum = parseInt(mMatch[1], 10);
                        if (!modulePrograms.has(mNum)) {
                            modulePrograms.set(mNum, new Set());
                        }
                        modulePrograms.get(mNum)!.add(caja.programa);
                    }
                });
            }

            const programIndicators: React.ReactNode[] = [];
            const isReversed = ['E1', 'E2', 'E3', 'E4a', 'E4b'].includes(u.id);

            for (let visualPos = 1; visualPos <= numModules; visualPos++) {
                // En las estanterías invertidas, la posición visual 1 (izquierda)
                // corresponde al módulo de mayor numeración.
                const logicalModuleId = isReversed ? (numModules - visualPos + 1) : visualPos;

                const programs = Array.from(modulePrograms.get(logicalModuleId) || []);
                if (programs.length > 0) {
                    // Tamaño de la "cajita" representativa del palet
                    const rectSize = 10; // Ancho y alto de la cajita (px)
                    const rectGap = 3;   // Espacio entre cajitas (px)
                    const totalWidth = (programs.length * rectSize) + ((programs.length - 1) * rectGap);
                    let startOffset = -totalWidth / 2; // Offset inicial para centrar todas las cajitas

                    let centerX, centerY;
                    if (rotationMode === 'vertical-ccw') {
                        // Centrado considerando la pestaña superior
                        centerX = -finalSvgW / 2 + ((visualPos - 0.5) * SHELF_MODULE_WIDTH * SCALE);
                        centerY = TAB_THICKNESS / 2;
                    } else {
                        // Centrado considerando la pestaña izquierda
                        centerX = TAB_THICKNESS / 2;
                        centerY = -finalSvgH / 2 + ((visualPos - 0.5) * SHELF_MODULE_WIDTH * SCALE);
                    }

                    programs.forEach((prog, index) => {
                        const color = programColors[prog] || programColors['Otros'] || '#E57373';
                        const offset = startOffset + (index * (rectSize + rectGap));

                        if (rotationMode === 'vertical-ccw') {
                            programIndicators.push(
                                <rect
                                    key={`ind-${visualPos}-${index}`}
                                    x={centerX + offset}
                                    y={centerY - rectSize / 2}
                                    width={rectSize}
                                    height={rectSize}
                                    fill={color}
                                    stroke="none"
                                    rx={2} // Bordes ligeramente redondeados (cajita)
                                    style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.25))' }}
                                />
                            );
                        } else {
                            programIndicators.push(
                                <rect
                                    key={`ind-${visualPos}-${index}`}
                                    x={centerX - rectSize / 2}
                                    y={centerY + offset}
                                    width={rectSize}
                                    height={rectSize}
                                    fill={color}
                                    stroke="none"
                                    rx={2} // Bordes ligeramente redondeados (cajita)
                                    style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.25))' }}
                                />
                            );
                        }
                    });
                }
            }

            const labelText = u.contenido && u.contenido.length < 10 ? u.contenido : u.id;

            content = (
                <React.Fragment>
                    <g {...bindMove()} style={{ cursor: interactionMode === 'move' ? 'grabbing' : 'grab', touchAction: 'none' }}>
                        {/* Sombra base suave */}
                        <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="none" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }} />

                        {/* Halo de Selección */}
                        {isSelected && <rect x={-finalSvgW / 2 - 4} y={-finalSvgH / 2 - 4} width={finalSvgW + 8} height={finalSvgH + 8} fill="none" stroke="#2E7D32" strokeWidth={2} rx={3} />}

                        {/* Superficie Blanca Limpia */}
                        <rect
                            x={-finalSvgW / 2}
                            y={-finalSvgH / 2}
                            width={finalSvgW}
                            height={finalSvgH}
                            fill={C_BG}
                            stroke={C_STROKE}
                            strokeWidth={1}
                            rx={2}
                        />

                        {/* Franja de Pestaña (Color Institucional Verde o Gris) */}
                        {rotationMode === 'vertical-ccw' ? (
                            <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={TAB_THICKNESS} fill={C_VERDE} />
                        ) : (
                            <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={TAB_THICKNESS} height={finalSvgH} fill={C_VERDE} />
                        )}

                        {/* Líneas divisorias internas */}
                        {dividers}

                        {/* Tooltip Nativo (Hover) */}
                        <title>{u.contenido || u.id}</title>

                        {/* Fichas de Color del Inventario (Centradas) */}
                        {programIndicators}

                        {/* Módulo IDs */}
                        {Array.from({ length: numModules }).map((_, i) => {
                            // INVERSIÓN ESPECÍFICA DE ESTANTERÍAS DEL MURO OESTE/SUR
                            // El cliente requiere explícitamente que E1, E2, E3, E4a y E4b
                            // inicien su módulo "1" en el origen de las mismas.
                            const isReversed = ['E1', 'E2', 'E3', 'E4a', 'E4b'].includes(u.id);
                            const moduleIndex = isReversed ? (numModules - i) : (i + 1);

                            let textX, textY;

                            if (rotationMode === 'vertical-ccw') {
                                textX = -finalSvgW / 2 + ((i + 0.5) * SHELF_MODULE_WIDTH * SCALE);
                                textY = TAB_THICKNESS / 2;
                            } else {
                                textY = -finalSvgH / 2 + ((i + 0.5) * SHELF_MODULE_WIDTH * SCALE);
                                textX = TAB_THICKNESS / 2;
                            }

                            return (
                                <text key={`lbl-${moduleIndex}`} x={textX - 8} y={textY - 2} fontSize={9} fontWeight="800" fill="#cfcfcf" textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                                    {moduleIndex}
                                </text>
                            );
                        })}

                    </g>

                    {/* Nombre flotante estilo pestaña adherido a la estructura o arrastrable */}
                    {(() => {
                        let textX = 0;
                        let textY = 0;

                        if (u.labelX !== undefined && u.labelY !== undefined) {
                            // Coordenadas manuales del arrastre libre
                            textX = liveLabelPos.x;
                            textY = liveLabelPos.y;
                        } else {
                            // Posición automática por defecto: flotando fuera de la esquina superior izquierda
                            // Se añaden unos -25px para que la etiqueta nazca bien despegada y sea súper fácil de pinchar
                            if (rotationMode === 'vertical-ccw') {
                                textX = -finalSvgW / 2 - 25;
                                textY = -finalSvgH / 2 - 15;
                            } else {
                                textX = -finalSvgW / 2 - 25;
                                textY = -finalSvgH / 2 - 15;
                            }
                            // Inicializar useRef para que el primer tick de arrastre parta de aquí
                            rawLabelPos.current = { x: textX, y: textY };
                        }

                        // Rotación individual
                        const labelRot = u.labelRot || 0;

                        // Extraemos los manejadores para poder interceptar y detener la propagación manual
                        const labelMoveHandlers = bindLabelMove() as any;

                        // Envolvemos en un grupo <g> y usamos transform translate.
                        // Añadimos un <rect> transparente pero con fill="transparent" (no "none") para crear una zona táctil maciza enorme alrededor del texto.
                        // pointerEvents="all" fuerza a que el recuadro invisible capture los eventos del ratón por encima de todo.
                        return (
                            <g
                                {...labelMoveHandlers}
                                onPointerDown={(e) => {
                                    // CRÍTICO: Detener propagación para que el DraggableObject padre no intercepte nuestro arrastre como un clic en la estantería
                                    e.stopPropagation();
                                    if (labelMoveHandlers.onPointerDown) labelMoveHandlers.onPointerDown(e);
                                }}
                                onPointerUp={(e) => {
                                    e.stopPropagation();
                                    if (labelMoveHandlers.onPointerUp) labelMoveHandlers.onPointerUp(e);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                    if (readOnly) return;
                                    e.stopPropagation();
                                    const newRot = (labelRot + 90) % 360;
                                    onUpdate({ ...u, labelRot: newRot });
                                }}
                                transform={`translate(${textX}, ${textY}) rotate(${labelRot})`}
                                style={{
                                    userSelect: 'none',
                                    cursor: interactionMode === 'move-label' ? 'grabbing' : 'grab',
                                    pointerEvents: 'all',
                                    touchAction: 'none'
                                }}
                            >
                                {/* Área táctil súper grande invisible para atrapar bien el dedo/ratón (pointerEvents="all") */}
                                <rect x={-15} y={-15} width={50} height={30} fill="transparent" />
                                <text
                                    x={0}
                                    y={0}
                                    fontSize={10}
                                    fontWeight="900"
                                    fill={C_VERDE}
                                    textAnchor="start"
                                    dominantBaseline="auto"
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {labelText}
                                </text>
                            </g>
                        );
                    })()}
                </React.Fragment>
            );
        } else if (u.tipo === 'zona_carga') {
            // FURGONETA: Diseño detallado estilo técnico
            // NOTA: En Modo Vertical ('vertical-ccw'), el mapa está rotado -90grados.
            // Queremos que la furgoneta aparezca 'derecha' respecto a la pantalla usualmente, o alineada con los muros.
            // 'currentRot' es la rotación física del objeto.
            // visualRot lo ajusta para el modo de visualización.

            const visualRot = (rotationMode === 'vertical-ccw') ? (-90 - currentRot) : 0;

            // Dimensiones en el sistema de coordenadas local SVG (antes de la rotación)
            const isHorizontalShape = finalSvgW > finalSvgH;

            // Para dibujar la furgoneta correctamente, necesitamos conocer su eje de 'longitud'.
            // Asumiendo que la Furgoneta siempre se dibuja a lo largo del eje de mayor longitud.
            const L = isHorizontalShape ? finalSvgW : finalSvgH;
            const W = isHorizontalShape ? finalSvgH : finalSvgW;

            // Colores Técnicos Limpios para Vehículo
            const colorBody = "#e0e0e0";    // Gris Plata Limpio
            const colorCabin = "#cfd8dc";   // Gris Azulado Claro
            const colorGlass = "#81d4fa";   // Azul Cian Claro (Cristal)
            const colorWheel = "#263238";   // Gris Muy Oscuro (Ruedas)
            const colorLight = "#fff176";   // Amarillo Pálido (Luces)

            content = (
                <g transform={`rotate(${visualRot})`}>
                    {/* Resaltado de Selección */}
                    {isSelected && <rect x={-finalSvgW / 2 - 4} y={-finalSvgH / 2 - 4} width={finalSvgW + 8} height={finalSvgH + 8} fill="none" stroke={C_VERDE} strokeWidth={2} rx={6} />}

                    {/* RUEDAS (4x) */}
                    {isHorizontalShape ? (
                        <>
                            <rect x={L / 2 - L * 0.15} y={-W / 2 - 2} width={L * 0.12} height={4} fill={colorWheel} rx={1} />
                            <rect x={L / 2 - L * 0.15} y={W / 2 - 2} width={L * 0.12} height={4} fill={colorWheel} rx={1} />
                            <rect x={-L / 2 + L * 0.05} y={-W / 2 - 2} width={L * 0.12} height={4} fill={colorWheel} rx={1} />
                            <rect x={-L / 2 + L * 0.05} y={W / 2 - 2} width={L * 0.12} height={4} fill={colorWheel} rx={1} />
                        </>
                    ) : (
                        <>
                            <rect x={-W / 2 - 2} y={-L / 2 + L * 0.15} width={4} height={L * 0.12} fill={colorWheel} rx={1} />
                            <rect x={W / 2 - 2} y={-L / 2 + L * 0.15} width={4} height={L * 0.12} fill={colorWheel} rx={1} />
                            <rect x={-W / 2 - 2} y={L / 2 - L * 0.05 - L * 0.12} width={4} height={L * 0.12} fill={colorWheel} rx={1} />
                            <rect x={W / 2 - 2} y={L / 2 - L * 0.05 - L * 0.12} width={4} height={L * 0.12} fill={colorWheel} rx={1} />
                        </>
                    )}

                    {/* CARROCERÍA PRINCIPAL */}
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill={colorBody} stroke="#9e9e9e" strokeWidth={1} rx={2} />

                    {/* CABINA / CAPÓ */}
                    {isHorizontalShape ? (
                        <path d={`
                            M ${L / 2 - L * 0.25} ${-W / 2} 
                            L ${L / 2 - 2} ${-W / 2} 
                            Q ${L / 2} ${-W / 2} ${L / 2} ${-W / 2 + 2} 
                            L ${L / 2} ${W / 2 - 2} 
                            Q ${L / 2} ${W / 2} ${L / 2 - 2} ${W / 2}
                            L ${L / 2 - L * 0.25} ${W / 2} 
                            Z
                        `} fill={colorCabin} stroke="none" />
                    ) : (
                        <path d={`
                            M ${-W / 2} ${-L / 2 + L * 0.25}
                            L ${-W / 2} ${-L / 2 + 2}
                            Q ${-W / 2} ${-L / 2} ${-W / 2 + 2} ${-L / 2}
                            L ${W / 2 - 2} ${-L / 2}
                            Q ${W / 2} ${-L / 2} ${W / 2} ${-L / 2 + 2}
                            L ${W / 2} ${-L / 2 + L * 0.25}
                            Z
                        `} fill={colorCabin} stroke="none" />
                    )}

                    {/* PARABRISAS (Cristal) */}
                    {isHorizontalShape ? (
                        <rect x={L / 2 - L * 0.24} y={-W / 2 + 2} width={L * 0.08} height={W - 4} fill={colorGlass} rx={1} />
                    ) : (
                        <rect x={-W / 2 + 2} y={-L / 2 + L * 0.24 - L * 0.08} width={W - 4} height={L * 0.08} fill={colorGlass} rx={1} />
                    )}

                    {/* LUCES */}
                    {isHorizontalShape ? (
                        <>
                            <circle cx={L / 2} cy={-W / 2 + W * 0.2} r={2} fill={colorLight} />
                            <circle cx={L / 2} cy={W / 2 - W * 0.2} r={2} fill={colorLight} />
                        </>
                    ) : (
                        <>
                            <circle cx={-W / 2 + W * 0.2} cy={-L / 2} r={2} fill={colorLight} />
                            <circle cx={W / 2 - W * 0.2} cy={-L / 2} r={2} fill={colorLight} />
                        </>
                    )}

                    {/* ESPEJOS RETROVISORES */}
                    {isHorizontalShape ? (
                        <>
                            <rect x={L / 2 - L * 0.22} y={-W / 2 - 3} width={3} height={3} fill={colorBody} stroke="#757575" strokeWidth={0.5} />
                            <rect x={L / 2 - L * 0.22} y={W / 2} width={3} height={3} fill={colorBody} stroke="#757575" strokeWidth={0.5} />
                        </>
                    ) : (
                        <>
                            <rect x={-W / 2 - 3} y={-L / 2 + L * 0.22 - 3} width={3} height={3} fill={colorBody} stroke="#757575" strokeWidth={0.5} />
                            <rect x={W / 2} y={-L / 2 + L * 0.22 - 3} width={3} height={3} fill={colorBody} stroke="#757575" strokeWidth={0.5} />
                        </>
                    )}

                    <text x={0} y={0} fontSize={9} fontWeight="600" fill="#455a64" textAnchor="middle" dy="0.3em" transform={`rotate(${-currentRot})`} style={{ pointerEvents: 'none' }}>FURGONETA</text>
                </g>
            );

        } else if (u.tipo === 'puerta') {
            // Estilo Técnico para Puertas: Arcos finos azules
            const isVertical = finalSvgH > finalSvgW;
            const r = isVertical ? finalSvgH / 2 : finalSvgW / 2;
            const strokeColor = isSelected ? C_VERDE : C_GRIS_OSCURO;
            const arcColor = "#0288d1"; // Azul info

            let doorContent;
            // ... [Lógica de geometría de puerta intacta] ...
            if (isVertical) {
                doorContent = (
                    <>
                        <line x1={0} y1={-finalSvgH / 2} x2={-r} y2={-finalSvgH / 2} stroke={strokeColor} strokeWidth={2} />
                        <path d={`M ${-r} ${-finalSvgH / 2} A ${r} ${r} 0 0 0 ${0} ${0}`} fill="none" stroke={arcColor} strokeWidth={1} strokeDasharray="4,2" />
                        <line x1={0} y1={finalSvgH / 2} x2={-r} y2={finalSvgH / 2} stroke={strokeColor} strokeWidth={2} />
                        <path d={`M ${-r} ${finalSvgH / 2} A ${r} ${r} 0 0 1 ${0} ${0}`} fill="none" stroke={arcColor} strokeWidth={1} strokeDasharray="4,2" />
                    </>
                );
            } else {
                const rH = finalSvgW / 2;
                const isVerticalMode = rotationMode === 'vertical-ccw';
                const leafEnd = isVerticalMode ? rH : -rH;
                const arcSweep1 = isVerticalMode ? 0 : 1;
                const arcSweep2 = isVerticalMode ? 1 : 0;
                doorContent = (
                    <>
                        <line x1={-finalSvgW / 2} y1={0} x2={-finalSvgW / 2} y2={leafEnd} stroke={strokeColor} strokeWidth={2} />
                        <path d={`M ${-finalSvgW / 2} ${leafEnd} A ${rH} ${rH} 0 0 ${arcSweep1} ${0} ${0}`} fill="none" stroke={arcColor} strokeWidth={1} strokeDasharray="4,2" />
                        <line x1={finalSvgW / 2} y1={0} x2={finalSvgW / 2} y2={leafEnd} stroke={strokeColor} strokeWidth={2} />
                        <path d={`M ${finalSvgW / 2} ${leafEnd} A ${rH} ${rH} 0 0 ${arcSweep2} ${0} ${0}`} fill="none" stroke={arcColor} strokeWidth={1} strokeDasharray="4,2" />
                    </>
                );
            }

            content = (
                <g>
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="none" stroke="none" />
                    {doorContent}
                    {u.contenido && !u.contenido.startsWith('door_') && (
                        <text x={0} y={0} fontSize={9} fill={C_GRIS_OSCURO} textAnchor="middle" transform={`rotate(${-currentRot})`} style={{ pointerEvents: 'none' }}>{u.contenido}</text>
                    )}
                </g>
            );

        } else if (u.tipo === 'muro') {
            content = (
                <g>
                    {/* MURO: Línea sólida técnica, gris muy oscuro */}
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="#424242" stroke="none" />
                </g>
            );
        } else { // Palé
            // PALÉ: Estilo limpio, borde de color funcional, fondo blanco

            // 1. Determinar Programas en el Palé (Contrato 3: Usar Lógica Compartida)
            const displayPrograms = getLotAttributes(u);

            // Limitar a máximo 4 bandas (Contrato 1: Regla Visual)
            const maxBands = 4;
            const bandsToShow = displayPrograms.slice(0, maxBands);
            const showOverflow = displayPrograms.length > maxBands;

            // Lógica de Estado
            const hasCajas = u.cajas && u.cajas.length > 0;
            const hasMaterial = u.materiales && u.materiales.length > 0;
            const isOccupied = hasCajas || hasMaterial;

            // Geometría de Banda
            // Bandas Verticales: Dividir Ancho
            // Las variables no usadas se han omitido para ESLint

            content = (
                <g>
                    {isSelected && <rect x={-finalSvgW / 2 - 3} y={-finalSvgH / 2 - 3} width={finalSvgW + 6} height={finalSvgH + 6} fill="none" stroke={C_VERDE} strokeWidth={2} rx={6} />}

                    {/* ClipPath para Palé Redondeado */}
                    <clipPath id={`clip-${u.id}`}>
                        <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} rx={4} />
                    </clipPath>

                    {/* Fondo y Borde de Estado */}
                    <rect
                        x={-finalSvgW / 2}
                        y={-finalSvgH / 2}
                        width={finalSvgW}
                        height={finalSvgH}
                        fill={isOccupied ? "#E0E0E0" : "white"} // Gris si ocupado, Blanco si libre
                        stroke={isValid ? (isOccupied ? "#9e9e9e" : "#4CAF50") : "#e57373"} // Borde Verde si libre, Gris si ocupado
                        strokeWidth={isOccupied ? 1 : 2}
                        rx={4}
                    />

                    {/* Renderizar Franjas de Color (Solo si está ocupado) */}
                    {isOccupied && (
                        <g clipPath={`url(#clip-${u.id})`}>
                            {bandsToShow.map((prog, idx) => {
                                // IGNORAR FRANJAS 'Vacio' -> Dejar que el fondo gris se vea natural.
                                if (!prog || prog === 'Vacio' || prog === 'vacio') return null;

                                const bColor = programColors[prog] || '#e0e0e0';

                                // ARREGLO CRÍTICO: Si el color es el GRIS "default" (#e0e0e0), 
                                // tratarlo como fondo y NO DIBUJAR franja o separador.
                                // Esto evita que aparezcan "líneas blancas divisorias" en palés sin lotes específicos.
                                if (bColor === '#e0e0e0') return null;

                                const count = maxBands;

                                // Comprobación de Rotación
                                const normRot = Math.abs(currentRot % 180);
                                const isVerticalOnScreen = normRot > 45 && normRot < 135;

                                let renderRect;
                                let separator = null;

                                if (isVerticalOnScreen) {
                                    // MODO ROTADO: Cortar ALTURA (eje Y).
                                    const bandH = finalSvgH / count;
                                    const by = -finalSvgH / 2 + (idx * bandH);

                                    // Línea Separadora en el FONDO de la franja (Fin de banda)
                                    // Solo si NO es la ultimísima clase o banda
                                    if (idx < maxBands - 1) {
                                        separator = <line x1={-finalSvgW / 2} y1={by + bandH} x2={finalSvgW / 2} y2={by + bandH} stroke="white" strokeWidth={1} />;
                                    }

                                    if (showOverflow && idx === maxBands - 1) {
                                        renderRect = (
                                            <g key={idx}>
                                                <rect x={-finalSvgW / 2} y={by} width={finalSvgW} height={bandH} fill="#f5f5f5" stroke="none" />
                                                {/* Puntos de desbordamiento (Overflow dots) */}
                                                <circle cx={-finalSvgW / 4} cy={by + bandH / 2} r={2} fill="#666" />
                                                <circle cx={0} cy={by + bandH / 2} r={2} fill="#666" />
                                                <circle cx={finalSvgW / 4} cy={by + bandH / 2} r={2} fill="#666" />
                                            </g>
                                        );
                                    } else {
                                        renderRect = (
                                            <g key={idx}>
                                                <rect
                                                    x={-finalSvgW / 2}
                                                    y={by}
                                                    width={finalSvgW}
                                                    height={bandH}
                                                    fill={bColor}
                                                    stroke="none"
                                                />
                                                {separator}
                                            </g>
                                        );
                                    }

                                } else {
                                    // MODO NORMAL: Cortar ANCHO (eje X).
                                    const bandW = finalSvgW / count;
                                    const bx = -finalSvgW / 2 + (idx * bandW);

                                    // Línea Separadora a la DERECHA
                                    if (idx < maxBands - 1) {
                                        separator = <line x1={bx + bandW} y1={-finalSvgH / 2} x2={bx + bandW} y2={finalSvgH / 2} stroke="white" strokeWidth={1} />;
                                    }

                                    if (showOverflow && idx === maxBands - 1) {
                                        renderRect = (
                                            <g key={idx}>
                                                <rect x={bx} y={-finalSvgH / 2} width={bandW} height={finalSvgH} fill="#f5f5f5" stroke="none" />
                                                <circle cx={bx + bandW / 2} cy={0} r={2} fill="#666" />
                                                <circle cx={bx + bandW / 2} cy={-6} r={2} fill="#666" />
                                                <circle cx={bx + bandW / 2} cy={6} r={2} fill="#666" />
                                            </g>
                                        );
                                    } else {
                                        renderRect = (
                                            <g key={idx}>
                                                <rect
                                                    x={bx}
                                                    y={-finalSvgH / 2}
                                                    width={bandW}
                                                    height={finalSvgH}
                                                    fill={bColor}
                                                    stroke="none"
                                                />
                                                {separator}
                                            </g>
                                        );
                                    }
                                }

                                return renderRect;
                            })}
                        </g>
                    )}

                    {/* Superposición de Borde (para limpiar los bordes) */}
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="none" stroke={isValid ? (isOccupied ? "#e0e0e0" : "#4CAF50") : "#e57373"} strokeWidth={1} rx={4} />


                    {/* ID */}
                    {/* Indicadores (Fijos al Palé) */}
                    {hasCajas && (
                        <rect x={-finalSvgW / 2 + 3} y={-finalSvgH / 2 + 3} width={6} height={6} fill="white" rx={1} stroke="#ccc" strokeWidth={0.5}>
                            <title>Contiene Cajas</title>
                        </rect>
                    )}
                    {hasCajas && (
                        <text x={-finalSvgW / 2 + 6} y={-finalSvgH / 2 + 7.5} fontSize={5} textAnchor="middle" fill="#333">📦</text>
                    )}

                    {/* ID (Flotante/Legible) */}
                    <g transform={`rotate(${-currentRot})`}>
                        <rect x={-12} y={-5} width={24} height={10} rx={2} fill="rgba(255,255,255,0.85)" />
                        <text x={0} y={2.5} fontSize={8} textAnchor="middle" fill="#1F2D2B" fontWeight="600" style={{ pointerEvents: 'none' }}>{u.id}</text>
                    </g>
                </g>
            );
        }
        return content;
    };

    return (
        <g id={`obj-${u.id}`} data-id={u.id} transform={`translate(${s.x}, ${s.y}) rotate(${currentRot})`} style={{ touchAction: 'none' }}>
            {/* Cuerpo Principal con Gestos */}
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

            {/* INTERFAZ DE TIRADORES */}
            {isSelected && (
                <>
                    {/* Esquinas */}
                    <circle key="TL" {...bindResize("TL")} cx={-finalSvgW / 2} cy={-finalSvgH / 2} r={5} fill="white" stroke="#2196F3" strokeWidth={2} style={{ cursor: "nw-resize" }} />
                    <circle key="TR" {...bindResize("TR")} cx={finalSvgW / 2} cy={-finalSvgH / 2} r={5} fill="white" stroke="#2196F3" strokeWidth={2} style={{ cursor: "ne-resize" }} />
                    <circle key="BL" {...bindResize("BL")} cx={-finalSvgW / 2} cy={finalSvgH / 2} r={5} fill="white" stroke="#2196F3" strokeWidth={2} style={{ cursor: "sw-resize" }} />
                    <circle key="BR" {...bindResize("BR")} cx={finalSvgW / 2} cy={finalSvgH / 2} r={5} fill="white" stroke="#2196F3" strokeWidth={2} style={{ cursor: "se-resize" }} />

                    {/* Artilugio de Rotación (Gizmo) */}
                    <g transform={`translate(0, ${-finalSvgH / 2 - 20})`} style={{ cursor: 'grab' }} {...bindRotate()} >
                        <circle cx={0} cy={0} r={5} fill="#2196F3" />
                    </g>
                </>
            )}
        </g>
    );
};

// Componente Simple de Cuadrícula (Eliminado: sin uso)
// const Grid: React.FC<{ width: number, height: number, scale: number }> = ({ width, height, scale }) => { ... };

const WarehouseMap = forwardRef<WarehouseMapRef, WarehouseMapProps>(({
    ubicaciones,
    onSelectLocation,
    selectedIds,
    onUpdate,
    geometry,
    onUpdateGeometry,
    onSelectMultiple,
    rotationMode = 'normal',
    showGrid = false,
    showGeoPoints = false,
    programColors = {},
    isMobile = false,
    readOnly = false,
    onVisitorError
}, ref) => {

    // Verificación de Autenticación
    const { user } = useAuth();
    const isVisitor = user?.role === 'VISITOR';
    // Estado local para el visualizador de arrastre (UI optimista)
    const [dragState, setDragState] = useState<{ id: string, x: number, y: number, rot: number, valid: boolean, w?: number, d?: number, groupIds?: string[], deltaX?: number, deltaY?: number } | null>(null);

    // Estado de Líneas de Ajuste (Snapping)
    const [snapLines, setSnapLines] = useState<SnapLine[]>([]);

    // Estado del Viewport (Desplazamiento y Zoom)
    const [view, setView] = useState({ x: 0, y: 0, k: 1 }); // Empezar limpio, el auto-ajuste se encargará de ello
    const containerRef = useRef<HTMLDivElement>(null);

    // Ayudante de Transformación de Coordenadas (Memorizado para ser usado en efectos)
    const toSVG = React.useCallback((uX: number, uY: number) => {
        if (rotationMode === 'vertical-ccw') {
            return { x: uX * SCALE, y: (29 - uY) * SCALE };
        }
        return { x: uY * SCALE, y: uX * SCALE };
    }, [rotationMode]); // Añadido rotationMode a las dependencias

    // --- LÓGICA DE AUTO-AJUSTE ---
    const fitToScreen = React.useCallback(() => {
        if (!containerRef.current || !geometry || geometry.length === 0) return;

        const { clientWidth: cw, clientHeight: ch } = containerRef.current;
        if (cw === 0 || ch === 0) return;

        // 1. Calcular Caja Delimitadora en el Espacio SVG
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        geometry.forEach(p => {
            const s = toSVG(p.x, p.y);
            // Asegurar que los valores sean finitos para prevenir la propagación de NaN
            if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
                if (s.x < minX) minX = s.x;
                if (s.x > maxX) maxX = s.x;
                if (s.y < minY) minY = s.y;
                if (s.y > maxY) maxY = s.y;
            }
        });

        // Comprobación de seguridad por si no se encuentran puntos válidos
        if (minX === Infinity || minY === Infinity) {
            console.warn("fitToScreen: Limites geométricos inválidos (infinito)");
            return;
        }

        const svgW = maxX - minX;
        const svgH = maxY - minY;

        // Prevenir la división por cero si la geometría es un solo punto o línea
        if (svgW <= 0 || svgH <= 0) {
            setView({ x: cw / 2, y: ch / 2, k: 1 });
            return;
        }

        const svgCX = (minX + maxX) / 2;
        const svgCY = (minY + maxY) / 2;

        // 2. Calcular Escala
        const PADDING = 40;
        const availableW = Math.max(10, cw - PADDING * 2);
        const availableH = Math.max(10, ch - PADDING * 2);

        const scaleX = availableW / svgW;
        const scaleY = availableH / svgH;
        // Limitar el zoom a valores razonables para evitar pantallas en blanco
        const newK = Math.min(Math.max(Math.min(scaleX, scaleY), 0.1), 3);

        // 3. Lógica de centrado
        const newX = (cw / 2) - (svgCX * newK);
        const newY = (ch / 2) - (svgCY * newK);

        // Solo actualizar si los valores son válidos
        if (Number.isFinite(newX) && Number.isFinite(newY) && Number.isFinite(newK)) {
            setView({ x: newX, y: newY, k: newK });
        }
    }, [geometry, toSVG]);

    // Activar Ajuste
    React.useLayoutEffect(() => {
        if (!containerRef.current) return;
        fitToScreen();
        const ro = new ResizeObserver(() => {
            if (containerRef.current && containerRef.current.clientWidth > 0) fitToScreen();
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [fitToScreen]);

    useImperativeHandle(ref, () => ({
        getViewCenter: () => {
            // ...
            // Usaremos el centro de la ventana como "Centro de Vista" por defecto
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;

            const svgX = (cx - view.x) / view.k;
            const svgY = (cy - view.y) / view.k;

            return { x: svgY / SCALE, y: svgX / SCALE };
        }
    }));

    // --- GESTOS DEL VIEWPORT Y SELECCIÓN ---
    const bindView = useGesture({
        onDragStart: ({ event }) => {
            // Prevenir los comportamientos de arrastre predeterminados del navegador
            if (event.cancelable) event.preventDefault();
        },
        onDrag: ({ event, first, last, xy: [x, y], memo, offset: [ox, oy] }) => {
            const isShift = event.shiftKey;

            if (isShift) {
                // Modo de Selección de Área
                const svg = (event.target as Element).closest('svg');
                if (!svg) return;

                const rect = svg.getBoundingClientRect();
                // Calcular Posición del Ratón en el "Espacio del Mundo SVG" (píxeles, pero corregido por zoom/paneo)
                // Usar 'x' e 'y' del estado del gesto, que son coordenadas del cliente
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
                        // Finalizar Selección
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
                            // Dimensiones SVG (Profundidad de Usuario -> Ancho SVG, Ancho de Usuario -> Altura SVG)
                            const sw = u.depth * SCALE;
                            const sh = u.width * SCALE;

                            // Obtener las esquinas del objeto (Rotado)
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

            // Desplazamiento Estándar (solo si no se está seleccionando)
            if (!isShift) {
                if (first) return { initialView: { ...view } };
                // Calcular delta desde el arrastre inicial
                // ¿Usamos memo para guardar el estado inicial? ¿O simplemente acumulamos?
                // el 'offset' de useGesture rastrea el movimiento total. 'movement' rastrea el movimiento del gesto.
                // Desplazamiento estándar: view.x = startView.x + mx

                // Uso correcto con 'from':
                // Usar 'offset', que rastrea el valor empezando desde 'from'.
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

    // Mejor Lógica de Zoom (Rueda del Ratón)
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


    // --- EDICIÓN DE GEOMETRÍA ---
    const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);

    // Calcular Muros Dinámicos para Colisión
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
                // Lógica del Modo Vertical (Igual que los Objetos)
                dXUser = dx / SCALE;
                dYUser = -dy / SCALE;
            } else {
                // Modo Horizontal
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



    // Renderizar Polígono del Suelo
    const renderFloor = () => {
        if (!geometry || geometry.length < 3) return null;

        const pathData = geometry.map((p, i) => {
            const s = toSVG(p.x, p.y);
            return `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
        }).join(' ') + ' Z';

        return (
            <>
                {/* 1. Fondo Blanco */}
                <path d={pathData} fill="#f2f2f2" stroke="#222" strokeWidth="5" strokeLinejoin="round" />

                {/* 2. Superposición de Cuadrícula (Recortada al Suelo) */}
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
                        // Eliminar punto
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
                        // Añadir punto proyectado en el segmento
                        // Convertir Ratón a Coordenadas de Usuario
                        // Los eventos SVG pueden ser complicados. Usemos getBoundingClientRect o conversión estándar.
                        const svgRect = e.currentTarget.closest('svg')?.getBoundingClientRect();
                        if (!svgRect) return;

                        const domX = e.clientX - svgRect.left;
                        const domY = e.clientY - svgRect.top;

                        // Transformación Inversa: translate(view.x, view.y) scale(view.k)
                        const localX = (domX - view.x) / view.k;
                        const localY = (domY - view.y) / view.k;

                        // Inversa de toSVG: x -> uY * SCALE, y -> uX * SCALE
                        const uX = localY / SCALE;
                        const uY = localX / SCALE;

                        // Proyectar sobre el segmento
                        const pt = projectPointOnSegment({ x: uX, y: uY }, p, pNext);

                        const newGeo = [...geometry];
                        // Insertar después de i
                        newGeo.splice(i + 1, 0, pt);
                        onUpdateGeometry(newGeo);
                    }}
                />
            );
        });
    };


    // --- ESTADO DE SELECCIÓN DE ÁREA ---
    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);

    // --- RENDERIZADORES ---

    const renderObjects = () => {
        // En SVG, el orden del DOM dicta el Z-Index.
        // Ordenamos las ubicaciones para garantizar que:
        // 1. Zonas de carga/Muros van primero (al fondo)
        // 2. Elementos con menor 'y' (más arriba en el plano) se dibujan antes, así los de más abajo (mayor 'y') se dibujan encima si se solapan.
        const sortedUbicaciones = Object.values(ubicaciones).sort((a, b) => {
            const typeWeight = (t: string) => {
                if (t === 'muro' || t === 'puerta') return 0;
                if (t === 'zona_carga') return 1;
                if (t === 'estanteria_modulo') return 2;
                return 3; // palet
            };
            const wDiff = typeWeight(a.tipo) - typeWeight(b.tipo);
            if (wDiff !== 0) return wDiff;
            // Si son del mismo tipo, ordenar de arriba a abajo en el PLANO VISUAL (coordenada Y resultante fina)
            const sA = toSVG(a.x, a.y);
            const sB = toSVG(b.x, b.y);
            return sA.y - sB.y;
        });

        return sortedUbicaciones.map(u => {
            // Arreglo para Colisión en Arrastre de Grupo:
            // Si estoy siendo arrastrado (ej. estoy en selectedIds y estamos arrastrando), 
            // NO debo comprobar la colisión contra otros elementos en "movimiento" (elementos en selectedIds).
            // Así que 'otherObstacles' debe excluir todos los elementos que están actualmente seleccionados (si yo estoy seleccionado).

            let obstacles = Object.values(ubicaciones).filter(o => o.id !== u.id);
            if (selectedIds.has(u.id)) {
                // Si soy parte de la selección, no chocar con otros en la selección
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
                    isMobile={isMobile}
                    readOnly={isVisitor || readOnly}
                    onVisitorError={onVisitorError}
                />
            );
        });
    };


    // --- AUTO-AJUSTE AL CARGAR Y REDIMENSIONAR ---
    // Auto-ajustar cuando la geometría cambia o en la primera carga
    React.useEffect(() => {
        if (geometry && geometry.length > 0) {
            console.log("WarehouseMap: Auto-ajustando a la pantalla...", { geometryPoints: geometry.length });
            // Pequeño retraso para asegurar que el DOM esté listo
            const timer = setTimeout(() => {
                fitToScreen();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            console.warn("WarehouseMap: No geometry to fit!");
        }
    }, [geometry, fitToScreen]);

    const viewHandlers = bindView();


    // Dimensiones de Cuadrícula
    const sGrid = 0.2 * SCALE;
    const lGrid = 1.0 * SCALE;

    return (
        <div
            ref={containerRef}
            className={styles.mapContainer}
            style={{ width: '100%', height: '100%', background: '#e0e0e0', overflow: 'hidden', cursor: 'grab', touchAction: 'none' }}
            {...viewHandlers}
            onPointerDown={(e) => {
                // Llamar al manejador de gestos primero
                viewHandlers.onPointerDown?.(e as any);

                // Clic en el Fondo para Deseleccionar
                if ((e.target as Element).tagName === 'svg' || (e.target as Element).id === 'bg-rect') {
                    if (onSelectLocation && (!selectedIds || selectedIds.size > 0)) {
                        onSelectLocation(null as any);
                        if (onSelectMultiple) onSelectMultiple([]);
                    }
                }
            }}
        >
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                    onClick={() => setView(v => ({ ...v, k: Math.min(5, v.k * 1.2) }))}
                    style={{ padding: '5px 10px', cursor: 'pointer' }}
                    title="Acercar Zoom"
                >
                    +
                </button>
                <button
                    onClick={() => setView(v => ({ ...v, k: Math.max(0.1, v.k / 1.2) }))}
                    style={{ padding: '5px 10px', cursor: 'pointer' }}
                    title="Alejar Zoom"
                >
                    -
                </button>
                <button
                    onClick={fitToScreen}
                    style={{ padding: '5px 10px', cursor: 'pointer' }}
                    title="Centrar Mapa"
                >
                    🎯
                </button>
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

                    {/* TEXTURA DE PALÉ */}
                    <pattern id="box-texture" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="8" stroke="#000" strokeWidth="2" opacity="0.1" />
                    </pattern>

                    {/* SOMBRA DE MURO */}
                    <filter id="wall-shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.2)" />
                    </filter>
                </defs>
                <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>

                    {/* SUELO (Editable por el Usuario) */}
                    {renderFloor()}



                    {/* GUÍAS DE RECORTE (SNAP) */}
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

                    {/* ZONAS Y RECURSOS */}
                    {renderObjects()}

                    {/* PUNTOS DE CONTROL DE GEOMETRÍA (Capa Superior) */}
                    {renderEdgeHitTargets()}
                    {renderGeoControlPoints()}

                    {/* SUPERPOSICIÓN DE CAJA DE SELECCIÓN */}
                    {selectionBox && (
                        <rect
                            x={Math.min(selectionBox.startX, selectionBox.currentX)}
                            y={Math.min(selectionBox.startY, selectionBox.currentY)}
                            width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                            height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                            fill="rgba(33, 150, 243, 0.2)"
                            stroke="#2196F3"
                            strokeWidth={2}
                            pointerEvents="none" // Importante: No bloquear eventos de arrastre
                        />
                    )}


                </g>
            </svg>
        </div>
    );
});

export default WarehouseMap;
