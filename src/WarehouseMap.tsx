import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './context/AuthContext';
import { useGesture } from '@use-gesture/react';
import type { Ubicacion } from './types';
import styles from './WarehouseMap.module.css';
import { getCorners, polygonsIntersect, generateWallsFromFloor, projectPointOnSegment } from './geometry';
import type { SnapLine } from './geometry';
import { getLotAttributes } from './utils/lotVisualizer';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

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
    activeFilter?: string | null;
    onProposeMove?: (updates: Ubicacion[]) => void;
}

export interface WarehouseMapRef {
    getViewCenter: () => { x: number, y: number };
}

const SCALE = 35; // px por metro

// --- COMPONENTE DE INTERACCIÓN ---

import { DraggableObject } from './components/Map/DraggableObject';


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
    isEditModeGlobal = false,
    onVisitorError,
    activeFilter = null,
    onProposeMove
}, ref) => {

    // Verificación de Autenticación
    const { user } = useAuth();
    const isVisitor = user?.role === 'VISITOR';
    // Estado local para el visualizador de arrastre (UI optimista)
    const [dragState, setDragState] = useState<{ id: string, x: number, y: number, rot: number, valid: boolean, w?: number, d?: number, groupIds?: string[], deltaX?: number, deltaY?: number } | null>(null);

    // Estado de Líneas de Ajuste (Snapping)
    const [snapLines, setSnapLines] = useState<SnapLine[]>([]);

    // Tooltip State
    const [tooltipData, setTooltipData] = useState<{ id: string, x: number, y: number } | null>(null);

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

    // --- LÓGICA DE AUTO-AJUSTE Y LIMITES ---
    // 1. Limitar el paneo y zoom
    const clampView = React.useCallback((vx: number, vy: number, vk: number) => {
        // 1.1 Limitar zoom (0.3 mínimo para no ver un punto, 3.5 máximo)
        const k = Math.max(0.3, Math.min(3.5, vk));
        
        let minX = 0, minY = 0, maxX = 1000, maxY = 1000;
        if (geometry && geometry.length > 2) {
            const pts = geometry.map(p => toSVG(p.x, p.y));
            minX = Math.min(...pts.map(p => p.x));
            minY = Math.min(...pts.map(p => p.y));
            maxX = Math.max(...pts.map(p => p.x));
            maxY = Math.max(...pts.map(p => p.y));
        }

        const ww = window.innerWidth;
        const wh = window.innerHeight;
        const padding = 100; // Al menos 100px del mapa deben ser visibles

        // 1.2 Calcular límites de paneo
        const limit1X = ww - padding - maxX * k;
        const limit2X = padding - minX * k;
        const safeLowerX = Math.min(limit1X, limit2X);
        const safeUpperX = Math.max(limit1X, limit2X);

        const limit1Y = wh - padding - maxY * k;
        const limit2Y = padding - minY * k;
        const safeLowerY = Math.min(limit1Y, limit2Y);
        const safeUpperY = Math.max(limit1Y, limit2Y);

        const x = Math.max(safeLowerX, Math.min(safeUpperX, vx));
        const y = Math.max(safeLowerY, Math.min(safeUpperY, vy));

        return { x, y, k };
    }, [geometry, toSVG]);

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

        // 2. Calcular Escala base
        const PADDING = isMobile ? 20 : 60;
        const availableW = Math.max(10, cw - PADDING * 2);
        const availableH = Math.max(10, ch - PADDING * 2);

        const scaleX = availableW / svgW;
        const scaleY = availableH / svgH;
        // Limitar el zoom inicial
        const newK = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 2.5);

        // 3. Lógica de centrado
        const newX = (cw / 2) - (svgCX * newK);
        // Desplazar el mapa hacia arriba 80px en escritorio para que esté más cerca del header
        const newY = (ch / 2) - (svgCY * newK) - (isMobile ? 0 : 80);

        // Solo actualizar si los valores son válidos
        if (Number.isFinite(newX) && Number.isFinite(newY) && Number.isFinite(newK)) {
            setView(clampView(newX, newY, newK));
        }
    }, [geometry, toSVG, isMobile, clampView]);

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
        onDragStart: ({ event, cancel }) => {
            if (isEditModeGlobal && (window as any).__IS_PALLET_DRAGGING__) {
                return cancel();
            }
            // Prevenir los comportamientos de arrastre predeterminados del navegador
            if (event.cancelable) event.preventDefault();
        },
        onDrag: ({ event, first, last, xy: [x, y], memo, offset: [ox, oy], cancel }) => {
            if (isEditModeGlobal && (window as any).__IS_PALLET_DRAGGING__) {
                return cancel();
            }
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
                setView(v => clampView(ox, oy, v.k));
            }
        },
        onPinch: ({ offset: [k], memo }) => {
            setView(v => clampView(v.x, v.y, k));
            return memo;
        }
    }, {
        drag: { from: () => [view.x, view.y], filterTaps: true },
        pinch: { scaleBounds: { min: 0.3, max: 3.5 }, rubberband: true, from: () => [view.k, 0] }
    });

    // Mejor Lógica de Zoom (Rueda del Ratón)
    useGesture({
        onWheel: ({ event, delta: [, dy], ctrlKey }) => {
            if (ctrlKey || event.metaKey) {
                event.preventDefault();
                const s = Math.exp(-dy * 0.001);
                setView(v => clampView(v.x, v.y, v.k * s));
            } else {
                setView(v => clampView(v.x - event.deltaX, v.y - event.deltaY, v.k));
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
                    activeFilter={activeFilter}
                    onProposeMove={onProposeMove}
                    onHover={(id, tx, ty) => {
                        console.log(`[Hover Debug] onHover triggered with id: ${id}`);
                        // Prevent flickering tooltips during dragging
                        if (!dragState) {
                            setTooltipData({ id, x: tx, y: ty });
                        }
                    }}
                    onLeave={() => {
                        console.log(`[Hover Debug] onLeave triggered!`);
                        setTooltipData(null);
                    }}
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

    // --- GLOBAL TOOLTIP HOVER LISTENER ---
    // A native DOM listener guarantees hit-testing is never swallowed by React synthetic events or
    // use-gesture bindings when navigating deeply nested SVG groups.
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (dragState) return;
            const target = e.target as Element;
            
            // Use .closest to guarantee we find the group even if the pointer hits the text or pill directly
            const moduleNode = target?.closest ? target.closest('[data-module]') : null;
            
            // --- CHIVATO DE CONSOLA PUNTUAL PARA ESTANTERÍAS ---
            // Solo logueamos si el ratón está tocando una etiqueta SVG (como <g>, <rect>, <text>, <title>) o si detecta el módulo
            // y limitamos por tiempo o spam visual si es necesario (mejor logueamos cuando esté encima de estanterias).
            // Si target es un Elemento común del fondo (id='bg-rect'), lo ignoramos para no saturar.
            if (target.id !== 'bg-rect' && target.tagName !== 'svg' && target.tagName !== 'DIV') {
                const isModuleGroup = moduleNode !== null;
                const parentGroup = target.closest('g');
                // Intentar leer atributo de un <g> superior que pudiera identificar si estamos en la zona de una estantería
                if (isModuleGroup || (parentGroup && parentGroup.getAttribute('data-id')?.startsWith('E'))) {
                     console.log(`[Ratón] Elemento tocado: <${target.tagName}>`, 
                                 (target as any).className?.baseVal || '', 
                                 target.id ? `id=${target.id}` : '',
                                 `moduleNode encontrado: ${isModuleGroup ? 'SÍ' : 'NO'}`,
                                 isModuleGroup ? `Módulo: ${moduleNode?.getAttribute('data-module')}` : '');
                }
            }
            
            if (moduleNode) {
                const dataModule = moduleNode.getAttribute('data-module');
                const dataShelf = moduleNode.getAttribute('data-shelf');
                if (dataModule && dataShelf) {
                    setTooltipData({ id: `${dataShelf}::${dataModule}`, x: e.clientX, y: e.clientY });
                }
            } else {
                setTooltipData(prev => {
                    if (prev && prev.id.includes('::')) return null;
                    return prev;
                });
            }
        };

        container.addEventListener('pointermove', handlePointerMove);
        return () => container.removeEventListener('pointermove', handlePointerMove);
    }, [dragState]);

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
            <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                zIndex: 5,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid rgba(0,0,0,0.05)',
                overflow: 'hidden'
            }}>
                <button
                    onClick={() => setView(v => ({ ...v, k: Math.min(5, v.k * 1.2) }))}
                    className={styles.mapToolBtn}
                    style={{ padding: '10px', cursor: 'pointer', border: 'none', background: 'transparent', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}
                    title="Acercar Zoom"
                >
                    <ZoomIn size={20} />
                </button>
                <button
                    onClick={() => setView(v => ({ ...v, k: Math.max(0.1, v.k / 1.2) }))}
                    className={styles.mapToolBtn}
                    style={{ padding: '10px', cursor: 'pointer', border: 'none', background: 'transparent', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}
                    title="Alejar Zoom"
                >
                    <ZoomOut size={20} />
                </button>
                <button
                    onClick={fitToScreen}
                    className={styles.mapToolBtn}
                    style={{ padding: '10px', cursor: 'pointer', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}
                    title="Centrar Mapa"
                >
                    <Maximize size={20} />
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

            {/* FAST HOVER TOOLTIP HTML OVERLAY */}
            {tooltipData && ubicaciones[tooltipData.id.split('::')[0]] && !dragState && !isMobile && (() => {
                const TOOLTIP_W = 240;
                const TOOLTIP_H = 180;
                const OFFSET    = 18;
                const HEADER_H  = 52;
                const mx = tooltipData.x;
                const my = tooltipData.y;
                const goLeft  = mx + OFFSET + TOOLTIP_W > window.innerWidth  - 10;
                const goAbove = my + OFFSET + TOOLTIP_H > window.innerHeight - 10;
                const tipLeft = goLeft  ? mx - OFFSET - TOOLTIP_W : mx + OFFSET;
                const tipTop  = goAbove ? my - OFFSET - TOOLTIP_H : my + OFFSET;
                const left = Math.max(10, Math.min(window.innerWidth  - TOOLTIP_W - 10, tipLeft));
                const top  = Math.max(HEADER_H, Math.min(window.innerHeight - TOOLTIP_H - 10, tipTop));
                return createPortal(
                    <div
                        className="map-tooltip"
                        style={{ left, top, width: TOOLTIP_W, pointerEvents: 'none', zIndex: 999999 }}
                    >

                    {(() => {
                        const tooltipIdStr = tooltipData.id || '';
                        const isModule = tooltipIdStr.includes('::');
                        let baseId = tooltipIdStr;
                        let moduleNum = '';
                        
                        if (isModule) {
                            const parts = tooltipIdStr.split('::');
                            baseId = parts[0];
                            moduleNum = parts[1];
                        }

                        const loc = ubicaciones[baseId];
                        if (!loc) return null;
                        
                        if (loc.tipo === 'muro' || loc.tipo === 'puerta' || loc.tipo === 'zona_carga') return <div>{loc.contenido || loc.id}</div>;

                        // Recolectar datos
                        const lots = new Set<string>();
                        const progs = new Set<string>();
                        const materials = new Set<string>();
                        let totalQty = 0;
                        let labelHead = loc.id;

                        if (loc.tipo === 'estanteria_modulo') {
                            if (isModule) {
                                labelHead = `Módulo ${moduleNum} - Est. ${baseId} ${loc.contenido ? `(${loc.contenido})` : ''}`;
                                if (loc.cajasEstanteria) {
                                    Object.entries(loc.cajasEstanteria).forEach(([key, cajaVal]) => {
                                        const mMatch = key.match(/M(\d+)/i);
                                        if (mMatch && parseInt(mMatch[1], 10) === parseInt(moduleNum, 10)) {
                                            const arr = Array.isArray(cajaVal) ? cajaVal : [cajaVal];
                                            arr.forEach(c => {
                                                const anyC = c as any;
                                                if (anyC['LOTE'] || anyC['lote']) lots.add(String(anyC['LOTE'] || anyC['lote']));
                                                
                                                const parsedProgs = getLotAttributes(c);
                                                parsedProgs.forEach(p => {
                                                    if (p !== 'Vacio') progs.add(p);
                                                });

                                                totalQty += (c.cantidad || anyC['CANTIDAD'] || 0);
                                                if (c.descripcion) materials.add(c.descripcion);
                                                if (c.contenido && Array.isArray(c.contenido)) {
                                                    c.contenido.forEach((mat: any) => {
                                                        if (mat.nombre) materials.add(mat.nombre);
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            } else {
                                // Fallback por si acaso
                                labelHead = `Estantería ${loc.id} ${loc.contenido ? `(${loc.contenido})` : ''}`;
                                Object.values(loc.cajasEstanteria || {}).forEach(cajaList => {
                                    const arr = Array.isArray(cajaList) ? cajaList : [cajaList];
                                    arr.forEach(c => {
                                        const anyC = c as any;
                                        if (anyC['LOTE'] || anyC['lote']) lots.add(String(anyC['LOTE'] || anyC['lote']));
                                        
                                        const parsedProgs = getLotAttributes(c);
                                        parsedProgs.forEach(p => {
                                            if (p !== 'Vacio') progs.add(p);
                                        });

                                        totalQty += (c.cantidad || anyC['CANTIDAD'] || 0);
                                        if (c.descripcion) materials.add(c.descripcion);
                                        if (c.contenido && Array.isArray(c.contenido)) {
                                            c.contenido.forEach((mat: any) => {
                                                if (mat.nombre) materials.add(mat.nombre);
                                            });
                                        }
                                    });
                                });
                            }
                        } else {
                            // Palet u otros
                            if (loc['LOTE']) lots.add(String(loc['LOTE']));
                            if (loc.programa && loc.programa !== 'Vacio') progs.add(loc.programa);
                            (loc.cajas || []).forEach(c => {
                                const anyC = c as any;
                                if (anyC['LOTE'] || anyC['lote']) lots.add(String(anyC['LOTE'] || anyC['lote']));
                                
                                const parsedProgs = getLotAttributes(c);
                                parsedProgs.forEach(p => {
                                    if (p !== 'Vacio') progs.add(p);
                                });

                                totalQty += (c.cantidad || anyC['CANTIDAD'] || 0);
                                if (c.descripcion) materials.add(c.descripcion);
                                if (c.contenido && Array.isArray(c.contenido)) {
                                    c.contenido.forEach((mat: any) => {
                                        if (mat.nombre) materials.add(mat.nombre);
                                    });
                                }
                            });
                            (loc.materiales || []).forEach(m => {
                                if (typeof m === 'string') materials.add(m);
                                else if (m.nombre) materials.add(m.nombre);
                            });
                        }

                        return (
                            <>
                                <h4>{labelHead}</h4>
                                {progs.size > 0 && (
                                    <p>
                                        <span className="label">Programa:</span>
                                        <span>{Array.from(progs).join(', ')}</span>
                                    </p>
                                )}
                                {lots.size > 0 && (
                                    <p>
                                        <span className="label">Lote:</span>
                                        <span>{Array.from(lots).join(', ')}</span>
                                    </p>
                                )}
                                {totalQty > 0 && (
                                    <p>
                                        <span className="label">Cantidad:</span>
                                        <span>{totalQty}</span>
                                    </p>
                                )}
                                {loc.tipo === 'palet' && loc.materiales && loc.materiales.length > 0 && (
                                    <p>
                                        <span className="label">Suelto:</span>
                                        <span>{loc.materiales.length} Ítems</span>
                                    </p>
                                )}
                                {materials.size > 0 && (
                                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                        <span className="label" style={{ display: 'block', marginBottom: '4px' }}>Contenido:</span>
                                        <ul style={{ margin: 0, paddingLeft: '16px', color: '#e0e0e0', fontSize: '12px', whiteSpace: 'normal', maxWidth: '200px' }}>
                                            {Array.from(materials).map((m, i) => (
                                                <li key={i}>{m}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {lots.size === 0 && progs.size === 0 && totalQty === 0 && (!loc.materiales || loc.materiales.length === 0) && materials.size === 0 && (
                                    <p style={{ color: '#aaa', fontStyle: 'italic', justifyContent: 'center' }}>Vacío</p>
                                )}
                            </>
                        );
                    })()}
                </div>,
                document.body
                );
            })()}
        </div>
    );
});

export default WarehouseMap;
