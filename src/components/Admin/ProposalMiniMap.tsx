import React from 'react';

interface ProposalMiniMapProps {
    /** Geometría del polígono de las paredes del almacén [{x, y}] */
    geometry: { x: number; y: number }[];
    /** Todas las ubicaciones del mapa para dar contexto */
    allLocations: Record<string, { id: string; tipo: string; x: number; y: number; width: number; depth: number; rotation: number }>;
    /** ID del palet que se está moviendo */
    palletId: string;
    /** Posición original del palet */
    originalX: number;
    originalY: number;
    /** Posición propuesta del palet */
    newX: number;
    newY: number;
    newRot?: number;
    /** Tamaño del widget */
    size?: number;
}

const SCALE = 35; // pixeles por metro (mismo que WarehouseMap)

export const ProposalMiniMap: React.FC<ProposalMiniMapProps> = ({
    geometry,
    allLocations,
    palletId,
    originalX,
    originalY,
    newX,
    newY,
    newRot = 0,
    size = 240
}) => {
    if (!geometry || geometry.length < 3) {
        return <div style={{ color: '#aaa', fontSize: 12 }}>Sin datos de mapa</div>;
    }

    // Coordenadas SVG
    const toSVGPt = (ux: number, uy: number) => ({ x: ux * SCALE, y: uy * SCALE });

    // Calcular bounding box del almacén
    const pts = geometry.map(p => toSVGPt(p.x, p.y));
    const allX = pts.map(p => p.x);
    const allY = pts.map(p => p.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);
    const warehouseW = maxX - minX;
    const warehouseH = maxY - minY;

    // Zoom: encajar en el widget con padding
    const padding = 14;
    const scaleX = (size - padding * 2) / warehouseW;
    const scaleY = (size - padding * 2) / warehouseH;
    const zoom = Math.min(scaleX, scaleY, 1.2);

    const tx = (svgX: number) => (svgX - minX) * zoom + padding;
    const ty = (svgY: number) => (svgY - minY) * zoom + padding;

    // Polígono de paredes
    const wallPolyline = pts.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ');

    // Objeto palet: dibuja rectángulo centrado
    const drawPallet = (ux: number, uy: number, rot: number, u: any, color: string, dasharray?: string, opacity = 1) => {
        const svgC = toSVGPt(ux, uy);
        const cx = tx(svgC.x);
        const cy = ty(svgC.y);
        const w = (u.width || 0.8) * SCALE * zoom;
        const h = (u.depth || 1.2) * SCALE * zoom;
        return (
            <rect
                x={cx - w / 2}
                y={cy - h / 2}
                width={w}
                height={h}
                fill={color}
                fillOpacity={0.35 * opacity}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={dasharray}
                opacity={opacity}
                transform={`rotate(${rot}, ${cx}, ${cy})`}
            />
        );
    };

    // Objetos de contexto (estanterías, muros, otros palets)
    const pallet = allLocations[palletId];

    const contextObjects = Object.values(allLocations).filter(
        u => u.id !== palletId
    );

    // Flecha de movimiento
    const origSvg = toSVGPt(originalX, originalY);
    const newSvg = toSVGPt(newX, newY);
    const ox = tx(origSvg.x);
    const oy = ty(origSvg.y);
    const nx = tx(newSvg.x);
    const ny = ty(newSvg.y);
    const hasMoved = Math.hypot(nx - ox, ny - oy) > 3;

    return (
        <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
            <svg
                width={size}
                height={size}
                style={{
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                    display: 'block'
                }}
            >
                {/* Paredes */}
                <polygon
                    points={wallPolyline}
                    fill="rgba(255,255,255,0.04)"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={1.5}
                />

                {/* Objetos de contexto */}
                {contextObjects.map(u => {
                    const svgC = toSVGPt(u.x, u.y);
                    const cx = tx(svgC.x);
                    const cy = ty(svgC.y);
                    const w = (u.width || 0.8) * SCALE * zoom;
                    const h = (u.depth || 1.2) * SCALE * zoom;
                    const isShelf = u.tipo?.includes('estanteria');
                    const isMuro = u.tipo?.includes('muro');
                    if (isMuro) return null;
                    return (
                        <rect
                            key={u.id}
                            x={cx - w / 2}
                            y={cy - h / 2}
                            width={w}
                            height={h}
                            fill={isShelf ? 'rgba(100,180,255,0.15)' : 'rgba(255,255,255,0.08)'}
                            stroke={isShelf ? 'rgba(100,180,255,0.4)' : 'rgba(255,255,255,0.2)'}
                            strokeWidth={0.8}
                            transform={`rotate(${u.rotation || 0}, ${cx}, ${cy})`}
                        />
                    );
                })}

                {/* Flecha de movimiento */}
                {hasMoved && (
                    <>
                        <defs>
                            <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="2" orient="auto">
                                <path d="M0,0 L0,4 L8,2 z" fill="#f39c12" />
                            </marker>
                        </defs>
                        <line
                            x1={ox} y1={oy}
                            x2={nx} y2={ny}
                            stroke="#f39c12"
                            strokeWidth={1.8}
                            strokeDasharray="4,3"
                            markerEnd="url(#arrow)"
                            opacity={0.85}
                        />
                    </>
                )}

                {/* Posición original (gris punteado) */}
                {pallet && drawPallet(originalX, originalY, pallet.rotation || 0, pallet, '#aaaaaa', '4,3', 0.8)}

                {/* Posición propuesta (verde brillante) */}
                {pallet && drawPallet(newX, newY, newRot, pallet, '#00e676', undefined, 1)}

                {/* Puntos centrales */}
                <circle cx={ox} cy={oy} r={3} fill="#aaa" opacity={0.8} />
                <circle cx={nx} cy={ny} r={4} fill="#00e676" />

                {/* Etiqueta del palet */}
                <text
                    x={nx + 5}
                    y={ny - 5}
                    fill="#00e676"
                    fontSize={9}
                    fontWeight="bold"
                    fontFamily="monospace"
                >
                    {palletId}
                </text>

                {/* Brújula / Noord */}
                <text x={size - 20} y={16} fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">N↑</text>
            </svg>

            {/* Leyenda */}
            <div style={{
                marginTop: 6,
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                fontSize: 11,
                color: '#999'
            }}>
                <span><span style={{ color: '#aaa' }}>▪</span> Actual</span>
                <span><span style={{ color: '#00e676' }}>▪</span> Propuesta</span>
            </div>
        </div>
    );
};
