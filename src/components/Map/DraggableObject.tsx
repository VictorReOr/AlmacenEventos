import React, { useState, useRef, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import type { Ubicacion } from '../../types';
import { getCorners, polygonsIntersect, calculateSnap, projectPointOnSegment } from '../../geometry';
import type { SnapLine } from '../../geometry';
import { ShelfGraphic } from './ShelfGraphic';
import { PalletGraphic } from './PalletGraphic';
import { useAuth } from '../../context/AuthContext';

const SCALE = 35; // px por metro
const SHELF_MODULE_WIDTH = 1.0; 
const SHELF_DEPTH = 0.45;

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
    activeFilter?: string | null;
    onHover?: (id: string, x: number, y: number) => void;
    onLeave?: () => void;
    onProposeMove?: (updates: Ubicacion[]) => void;
}

export const DraggableObject: React.FC<DraggablePalletProps & { isMobile: boolean, readOnly?: boolean }> = ({ u, isSelected, dragState, setDragState, onSelectLocation, onUpdate, toSVG, otherObstacles, allObjects, setSnapLines, walls, selectedIds, geometry, zoomScale, rotationMode = 'normal', programColors, isMobile, readOnly, isEditModeGlobal, onVisitorError, activeFilter, onHover, onLeave, onProposeMove }) => {
    const dragGroupRef = useRef<SVGGElement>(null);
    const { user } = useAuth(); // <- Añadido para restringir estructurales a rol USER

    // USER role puede arrastrar palets aunque isEditModeGlobal esté off (para el flujo de propuestas)
    const canUserDragPallet = user?.role === 'USER' && u.tipo === 'palet' && !!onProposeMove;

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

    useGesture({
        onDragStart: ({ event, cancel }) => {
            // RESTRICCIÓN: LA FURGONETA ES INAMOVIBLE
            if (u.id === 'van_v3' || u.tipo === 'zona_carga') {
                cancel();
                return;
            }

            // RESTRICCIÓN: USER SOLO PUEDE MOVER PALETS, NUNCA ESTRUCTURAS
            if (user?.role === 'USER' && u.tipo !== 'palet') {
                // Notificación silenciosa a consola o alerta rápida (el cliente ya tiene UI feedback)
                console.warn(`[Security] Rol USER no autorizado a mover objeto estructural: ${u.tipo}`);
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
            if (readOnly || (!isEditModeGlobal && !canUserDragPallet)) {
                // Sólo detener el arrastre, ya hemos seleccionado el artículo.
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
        onDrag: ({ pinching, cancel, event, last, movement: [mx, my] }) => {
            console.log(`[DRAG_TELEMETRY] ID=${u.id} last=${last} movement=[${mx}, ${my}] dragState=`, dragState);
            if (u.id === 'van_v3' || u.tipo === 'zona_carga') return cancel();
            if (readOnly || (!isEditModeGlobal && !canUserDragPallet)) return cancel();
            if (pinching) return cancel();
            event.stopPropagation();
            hasDragged.current = true;

            let uDx = 0;
            let uDy = 0;

            // 'mx' and 'my' represent absolute offset distance in pixels since pointerdown.
            if (rotationMode === 'vertical-ccw') {
                uDx = mx / SCALE / zoomScale;
                uDy = -my / SCALE / zoomScale;
            } else {
                uDx = my / SCALE / zoomScale;
                uDy = mx / SCALE / zoomScale;
            }

            let newX = u.x + uDx;
            let newY = u.y + uDy;

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

            // Direct DOM Mutation Bypass for instant unthrottled 60fps performance without React bottlenecks
            const s = toSVG(newX, newY);
            const domEl = document.getElementById(`obj-${u.id}`);
            if (domEl) {
                domEl.setAttribute('transform', `translate(${s.x}, ${s.y}) rotate(${currentRot})`);
                
                const polyEl = domEl.querySelector('polygon, rect, path');
                if (polyEl) {
                    if (!valid) polyEl.setAttribute('stroke', 'red');
                    else polyEl.removeAttribute('stroke');
                }
            }

            setDragState({
                id: u.id, x: newX, y: newY, rot: currentRot, valid, w: currentW, d: currentD,
                groupIds,
                deltaX: finalDeltaX,
                deltaY: finalDeltaY
            });

            if (last) {
                setSnapLines([]);
                
                const updates = [{ ...u, x: newX, y: newY }];
                
                groupIds.forEach(gid => {
                    if (gid !== u.id && allObjects[gid] && allObjects[gid].id !== 'van_v3' && allObjects[gid].tipo !== 'zona_carga') {
                        updates.push({ ...allObjects[gid], x: allObjects[gid].x + finalDeltaX, y: allObjects[gid].y + finalDeltaY });
                    }
                });

                if (user?.role === 'USER' && onProposeMove) {
                    onProposeMove(updates);
                    alert("Se ha registrado una propuesta de cambio de ubicación. A la espera de aprobación por el administrador.");
                } else {
                    onUpdate(updates);
                }
                
                setDragState(null);
                setInteractionMode(null);
                setTimeout(() => { hasDragged.current = false; }, 0);
            }
        }
    }, {
        target: dragGroupRef,
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

    // Refs para control de animaciones y performance
    const isLongPressed = useRef(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Prevención de Bloqueo de Arrastre Global (Auto-Cleanup)
    useEffect(() => {
        const cleanupLock = () => { (window as any).__IS_PALLET_DRAGGING__ = false; };
        window.addEventListener('pointerup', cleanupLock);
        return () => window.removeEventListener('pointerup', cleanupLock);
    }, []);
    const hasDragged = useRef(false); // Restaurar para prevenir ReferenceError en bindMove

    // --- MANEJADORES DE CLIC Y PULSACIÓN LARGA ---
    const startClickPos = useRef({ x: 0, y: 0 }); // Rastrear para la detección de clic manual

    const handlePointerDown = (e: React.PointerEvent) => {
        // Enlazar bandera global para silenciar el Panning del lienzo principal instantáneamente
        (window as any).__IS_PALLET_DRAGGING__ = true;

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
        (window as any).__IS_PALLET_DRAGGING__ = false;
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
            content = (
                <ShelfGraphic
                    u={u}
                    finalSvgW={finalSvgW}
                    finalSvgH={finalSvgH}
                    rotationMode={rotationMode}
                    SCALE={SCALE}
                    programColors={programColors || {}}
                    isSelected={isSelected}
                    interactionMode={interactionMode}
                    readOnly={readOnly || false}
                    bindLabelMove={bindLabelMove}
                    liveLabelPos={liveLabelPos}
                    rawLabelPos={rawLabelPos}
                    onUpdate={onUpdate}
                    SHELF_MODULE_WIDTH={SHELF_MODULE_WIDTH}
                    activeFilter={activeFilter}
                />
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
            content = (
                <PalletGraphic
                    u={u}
                    finalSvgW={finalSvgW}
                    finalSvgH={finalSvgH}
                    programColors={programColors || {}}
                    isSelected={isSelected}
                    currentRot={currentRot}
                    isValid={isValid || false}
                    activeFilter={activeFilter}
                />
            );
        }
        return content;
    };

    // Determine if this object should be dimmed out by the legend filter
    let isDimmedByFilter = false;
    if (activeFilter) {
        if (u.tipo === 'palet') {
            const matList = (u.materiales || []).filter(m => typeof m === 'string' ? (m as any).trim().length > 0 : m.nombre && m.nombre.trim().length > 0);
            const boxPrograms = (u.cajas || []).filter(c => c.programa && c.programa !== 'Vacio').map(c => c.programa);
            const legacyItems = (u.items || []).filter((i: any) => typeof i === 'string' && i.trim().length > 0);
            const pBase = u.programa && u.programa !== 'Vacio' ? [u.programa] : [];
            const allAvailable = [...matList, ...boxPrograms, ...legacyItems, ...pBase];
            // Since matList and legacyItems might be names, let's just use the strict activeFilter inclusion or check if activeFilter matches 'Otros'
            if (activeFilter === 'Otros') {
                isDimmedByFilter = !allAvailable.some(p => p === 'Otros');
            } else {
                isDimmedByFilter = !allAvailable.some(p => p === activeFilter);
            }
        } else if (u.tipo === 'estanteria_modulo') {
            let hasMatch = false;
            Object.values(u.cajasEstanteria || {}).forEach(cajaList => {
                const cajas = Array.isArray(cajaList) ? cajaList : [cajaList];
                cajas.forEach(c => {
                    const prog = c.programa || 'Otros';
                    if (prog === activeFilter || (activeFilter === 'Otros' && prog === 'Otros')) hasMatch = true;
                });
            });
            isDimmedByFilter = !hasMatch;
        } else {
            // Never dim walls or load zones by legend filter
            isDimmedByFilter = false;
        }
    }

    return (
        <g id={`obj-${u.id}`} data-id={u.id} transform={`translate(${s.x}, ${s.y}) rotate(${currentRot})`} style={{ touchAction: 'none' }}>
            {/* Cuerpo Principal con Gestos */}
            <g
                ref={dragGroupRef}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerEnter={(e) => {
                    if (u.tipo !== 'estanteria_modulo' && interactionMode !== 'move' && interactionMode !== 'resize' && interactionMode !== 'move-label' && onHover) {
                        onHover(u.id, e.clientX, e.clientY);
                    }
                }}
                onPointerMove={(e) => {
                    if (u.tipo !== 'estanteria_modulo' && interactionMode !== 'move' && interactionMode !== 'resize' && interactionMode !== 'move-label' && onHover) {
                        onHover(u.id, e.clientX, e.clientY);
                    }
                }}
                onPointerLeave={() => {
                    if (onLeave) onLeave();
                }}
                onClick={handleClick}
                style={{ cursor: interactionMode === 'resize' ? 'crosshair' : 'pointer', touchAction: 'none' }}
                className={isDimmedByFilter ? 'dimmed-location' : ''}
            >
                {renderVisuals()}
            </g>

            {/* INTERFAZ DE TIRADORES */}
            {isSelected && u.tipo !== 'estanteria_modulo' && (
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
