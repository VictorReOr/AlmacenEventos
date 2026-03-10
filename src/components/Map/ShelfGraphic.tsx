import React from 'react';
import type { Ubicacion } from '../../types';
import { getLotAttributes } from '../../utils/lotVisualizer';

interface ShelfGraphicProps {
    u: Ubicacion;
    finalSvgW: number;
    finalSvgH: number;
    rotationMode: string;
    SCALE: number;
    programColors: Record<string, string>;
    isSelected: boolean;
    interactionMode: string | null;
    readOnly: boolean;
    bindMove: () => any;
    bindLabelMove: () => any;
    liveLabelPos: { x: number; y: number };
    rawLabelPos: React.MutableRefObject<{ x: number; y: number }>;
    onUpdate: (u: Ubicacion) => void;
    SHELF_MODULE_WIDTH?: number;
    activeFilter?: string | null;
}

export const ShelfGraphic: React.FC<ShelfGraphicProps> = ({
    u,
    finalSvgW,
    finalSvgH,
    rotationMode,
    SCALE,
    programColors,
    isSelected,
    interactionMode,
    readOnly,
    bindMove,
    bindLabelMove,
    liveLabelPos,
    rawLabelPos,
    onUpdate,
    SHELF_MODULE_WIDTH = 1.0,
    activeFilter
}) => {
    // Colores Institucionales
    const C_VERDE = "#007A33";
    const C_BG = "#FFFFFF";
    const C_STROKE = "#CFD8DC";
    const TAB_THICKNESS = 6;

    const numModules = Math.round(u.width / SHELF_MODULE_WIDTH);

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
    const moduleProgramDetails = new Map<number, Map<string, { count: number, lots: Set<string> }>>();

    if (u.cajasEstanteria) {
        Object.entries(u.cajasEstanteria).forEach(([key, cajaVal]) => {
            const mMatch = key.match(/M(\d+)/);
            if (mMatch) {
                const mNum = parseInt(mMatch[1], 10);
                if (!modulePrograms.has(mNum)) {
                    modulePrograms.set(mNum, new Set());
                    moduleProgramDetails.set(mNum, new Map());
                }

                // GoogleSheetsService envuelve las cajas en un Array (shelfItems), mientras que InventoryService usa un objeto directo.
                const cajasLote = Array.isArray(cajaVal) ? cajaVal : [cajaVal];

                cajasLote.forEach(caja => {
                    const progs = getLotAttributes(caja); // Devuelve array de programas hallados en esta caja
                    progs.forEach((p: string) => {
                        if (p !== 'Vacio') {
                            modulePrograms.get(mNum)!.add(p);

                            // Guardar detalles para el tooltip
                            const detailsMap = moduleProgramDetails.get(mNum)!;
                            if (!detailsMap.has(p)) {
                                detailsMap.set(p, { count: 0, lots: new Set() });
                            }
                            const pDetails = detailsMap.get(p)!;
                            pDetails.count += 1;
                            if (caja.LOTE) pDetails.lots.add(String(caja.LOTE));
                        }
                    });
                });
            }
        });
    }

    const programIndicators: React.ReactNode[] = [];
    // Convertimos u.id a lowercase para comparar de forma segura con e4a, e4b, etc.
    const normalizedId = u.id.toLowerCase();
    const isReversed = ['e1', 'e2', 'e3', 'e4a', 'e4b'].includes(normalizedId);
    // Variables geométricas base (Limpiadas de los antiguos círculos)
    // Variables geométricas base de los círculos de la Leyenda

    // DETERMINAR MÁXIMO NÚMERO DE MÓDULOS INCLUYENDO CUALQUIER DATO REGISTRADO FUERA DE BANDAS
    let maxModuleInDataNum = 0;
    modulePrograms.forEach((_, key) => {
        if (key > maxModuleInDataNum) maxModuleInDataNum = key;
    });
    // Forzar renderizado hasta el máximo módulo reportado si supera el dibujo físico base
    const totalModulesToRender = Math.max(numModules, maxModuleInDataNum);

    for (let visualPos = 1; visualPos <= totalModulesToRender; visualPos++) {
        const logicalModuleId = isReversed ? (totalModulesToRender - visualPos + 1) : visualPos;
        const programs = Array.from(modulePrograms.get(logicalModuleId) || []);

        if (programs.length > 0) {
            // Tamaño del módulo a lo largo de la estantería:
            const moduleLength = SHELF_MODULE_WIDTH * SCALE;
            const stripeLength = moduleLength / programs.length;

            programs.forEach((prog, index) => {
                const color = programColors[prog] || programColors['Otros'] || '#E57373';

                const p = 3; // Padding interno para que los bloques no se peguen (estilo pales)

                if (rotationMode === 'vertical-ccw') {
                    // Estantería Horizontal
                    const innerHeight = finalSvgH - TAB_THICKNESS;
                    const startX = -finalSvgW / 2 + ((visualPos - 1) * moduleLength);
                    const baseRectX = startX + (index * stripeLength);
                    const baseRectY = -finalSvgH / 2 + TAB_THICKNESS;

                    const isProgramDimmed = activeFilter && activeFilter !== prog && (activeFilter === 'Otros' ? prog !== 'Otros' : true);

                    programIndicators.push(
                        <rect
                            key={`ind-${visualPos}-${index}`}
                            x={baseRectX + p}
                            y={baseRectY + p}
                            width={Math.max(1, stripeLength - (p * 2))}
                            height={Math.max(1, innerHeight - (p * 2))}
                            fill={color}
                            rx={3} ry={3} // Bordes redondeados
                            stroke="rgba(0,0,0,0.15)" strokeWidth={1}
                            style={{
                                filter: isProgramDimmed ? 'grayscale(80%)' : 'drop-shadow(0px 2px 3px rgba(0,0,0,0.25))',
                                opacity: isProgramDimmed ? 0.2 : 1,
                                transition: 'opacity 0.2s, filter 0.2s'
                            }}
                        />
                    );
                } else {
                    // Estantería Vertical
                    const innerWidth = finalSvgW - TAB_THICKNESS;
                    const startY = -finalSvgH / 2 + ((visualPos - 1) * moduleLength);
                    const baseRectY = startY + (index * stripeLength);
                    const baseRectX = -finalSvgW / 2 + TAB_THICKNESS;

                    const isProgramDimmed = activeFilter && activeFilter !== prog && (activeFilter === 'Otros' ? prog !== 'Otros' : true);

                    programIndicators.push(
                        <rect
                            key={`ind-${visualPos}-${index}`}
                            x={baseRectX + p}
                            y={baseRectY + p}
                            width={Math.max(1, innerWidth - (p * 2))}
                            height={Math.max(1, stripeLength - (p * 2))}
                            fill={color}
                            rx={3} ry={3}
                            stroke="rgba(0,0,0,0.15)" strokeWidth={1}
                            style={{
                                filter: isProgramDimmed ? 'grayscale(80%)' : 'drop-shadow(0px 2px 3px rgba(0,0,0,0.25))',
                                opacity: isProgramDimmed ? 0.2 : 1,
                                transition: 'opacity 0.2s, filter 0.2s'
                            }}
                        />
                    );
                }
            });
        }
    }

    const labelText = u.contenido && u.contenido.length < 10 ? u.contenido : u.id;

    // Etiqueta Arrastrable
    const renderLabel = () => {
        let textX = 0;
        let textY = 0;

        const hasManualPos = rotationMode === 'vertical-ccw'
            ? (u.labelXV !== undefined && u.labelYV !== undefined)
            : (u.labelX !== undefined && u.labelY !== undefined);

        if (hasManualPos) {
            textX = interactionMode === 'move-label' ? liveLabelPos.x : (rotationMode === 'vertical-ccw' ? u.labelXV! : u.labelX!);
            textY = interactionMode === 'move-label' ? liveLabelPos.y : (rotationMode === 'vertical-ccw' ? u.labelYV! : u.labelY!);
        } else {
            if (rotationMode === 'vertical-ccw') {
                textX = -finalSvgW / 2 - 15;
                textY = -finalSvgH / 2 - 25;
            } else {
                textX = -finalSvgW / 2 - 25;
                textY = -finalSvgH / 2 - 15;
            }
            rawLabelPos.current = { x: textX, y: textY };
        }

        const labelRot = u.labelRot || 0;
        const labelMoveHandlers = bindLabelMove() as any;

        return (
            <g
                {...labelMoveHandlers}
                onPointerDown={(e) => {
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
    };

    // Determine if the whole shelf is dimmed (no matching boxes)
    let isShelfDimmed = false;
    if (activeFilter) {
        let hasMatch = false;
        Object.values(u.cajasEstanteria || {}).forEach(cajaList => {
            const cajas = Array.isArray(cajaList) ? cajaList : [cajaList];
            cajas.forEach(c => {
                const prog = c.programa || 'Otros';
                if (prog === activeFilter) hasMatch = true;
            });
        });
        isShelfDimmed = !hasMatch;
    }

    const isShelfHighlighted = activeFilter && !isShelfDimmed;
    const activeColor = activeFilter ? (programColors[activeFilter] || programColors['Otros'] || '#ff9800') : '#ff9800';

    return (
        <React.Fragment>
            <g
                {...bindMove()}
                className={isShelfHighlighted ? 'aura-highlight' : ''}
                style={{
                    '--aura-color': activeColor,
                    cursor: interactionMode === 'move' ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    opacity: isShelfDimmed ? 0.3 : 1,
                    filter: isShelfDimmed ? 'grayscale(80%)' : undefined,
                    transition: 'opacity 0.2s, filter 0.2s'
                } as React.CSSProperties}
            >
                <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="none" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }} />
                {isSelected && <rect x={-finalSvgW / 2 - 4} y={-finalSvgH / 2 - 4} width={finalSvgW + 8} height={finalSvgH + 8} fill="none" stroke="#2E7D32" strokeWidth={2} rx={3} />}

                <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill={C_BG} stroke={C_STROKE} strokeWidth={1} rx={2} />

                {rotationMode === 'vertical-ccw' ? (
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={TAB_THICKNESS} fill={C_VERDE} />
                ) : (
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={TAB_THICKNESS} height={finalSvgH} fill={C_VERDE} />
                )}

                {dividers}
                <title>{u.contenido || u.id}</title>
                {programIndicators}

                {Array.from({ length: numModules }).map((_, i) => {
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
                        <g key={`lbl-${moduleIndex}`}>
                            <text x={textX - 8} y={textY - 2} fontSize={9} fontWeight="800" fill="#cfcfcf" textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                                {moduleIndex}
                            </text>
                            {/* DEBUG VISUAL TEMP */}
                        </g>
                    );
                })}
            </g>
            {renderLabel()}
        </React.Fragment>
    );
};
