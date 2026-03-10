import React from 'react';
import type { Ubicacion } from '../../types';
import { getLotAttributes } from '../../utils/lotVisualizer';

interface PalletGraphicProps {
    u: Ubicacion;
    finalSvgW: number;
    finalSvgH: number;
    programColors: Record<string, string>;
    isSelected: boolean;
    currentRot: number;
    isValid: boolean;
    activeFilter?: string | null;
}

export const PalletGraphic: React.FC<PalletGraphicProps> = ({
    u,
    finalSvgW,
    finalSvgH,
    programColors,
    isSelected,
    currentRot,
    isValid,
    activeFilter
}) => {
    const C_VERDE = "#007A33";

    const displayPrograms = getLotAttributes(u);
    const maxBands = 4;
    const bandsToShow = displayPrograms.slice(0, maxBands);
    const showOverflow = displayPrograms.length > maxBands;

    const hasCajas = u.cajas && u.cajas.length > 0;
    const hasMaterial = u.materiales && u.materiales.length > 0;
    const isOccupied = hasCajas || hasMaterial;

    // Determine if this pallet should be dimmed
    let isDimmed = false;
    if (activeFilter) {
        isDimmed = !displayPrograms.some(prog => prog === activeFilter);
    }

    const isHighlighted = activeFilter && !isDimmed;
    const activeColor = activeFilter ? (programColors[activeFilter] || programColors['Otros'] || '#ff9800') : '#ff9800';

    return (
        <React.Fragment>
            <g
                className={isHighlighted ? 'aura-highlight' : ''}
                style={{
                    '--aura-color': activeColor,
                    opacity: isDimmed ? 0.15 : (Number(u.depth) === 0.3 ? 0.6 : 1),
                    filter: isDimmed ? 'grayscale(80%)' : undefined,
                    transition: 'opacity 0.2s, filter 0.2s'
                } as React.CSSProperties}
            >
                {isSelected && <rect x={-finalSvgW / 2 - 3} y={-finalSvgH / 2 - 3} width={finalSvgW + 6} height={finalSvgH + 6} fill="none" stroke={C_VERDE} strokeWidth={2} rx={6} />}

                <clipPath id={`clip-${u.id}`}>
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} rx={4} />
                </clipPath>

                <rect
                    x={-finalSvgW / 2}
                    y={-finalSvgH / 2}
                    width={finalSvgW}
                    height={finalSvgH}
                    fill={isOccupied ? "#E0E0E0" : "white"}
                    stroke={isValid ? (isOccupied ? "#9e9e9e" : "#4CAF50") : "#e57373"}
                    strokeWidth={isOccupied ? 1 : 2}
                    rx={4}
                />

                {isOccupied && (
                    <g clipPath={`url(#clip-${u.id})`}>
                        {bandsToShow.map((prog, idx) => {
                            if (!prog || prog === 'Vacio' || prog === 'vacio') return null;

                            const bColor = programColors[prog] || '#e0e0e0';

                            if (bColor === '#e0e0e0') return null;

                            const count = maxBands;
                            const normRot = Math.abs(currentRot % 180);
                            const isVerticalOnScreen = normRot > 45 && normRot < 135;

                            let renderRect;
                            let separator = null;

                            if (isVerticalOnScreen) {
                                const bandH = finalSvgH / count;
                                const by = -finalSvgH / 2 + (idx * bandH);

                                if (idx < maxBands - 1) {
                                    separator = <line x1={-finalSvgW / 2} y1={by + bandH} x2={finalSvgW / 2} y2={by + bandH} stroke="white" strokeWidth={1} />;
                                }

                                if (showOverflow && idx === maxBands - 1) {
                                    renderRect = (
                                        <g key={idx}>
                                            <rect x={-finalSvgW / 2} y={by} width={finalSvgW} height={bandH} fill="#f5f5f5" stroke="none" />
                                            <circle cx={-finalSvgW / 4} cy={by + bandH / 2} r={2} fill="#666" />
                                            <circle cx={0} cy={by + bandH / 2} r={2} fill="#666" />
                                            <circle cx={finalSvgW / 4} cy={by + bandH / 2} r={2} fill="#666" />
                                        </g>
                                    );
                                } else {
                                    renderRect = (
                                        <g key={idx}>
                                            <rect x={-finalSvgW / 2} y={by} width={finalSvgW} height={bandH} fill={bColor} stroke="none" />
                                            {separator}
                                        </g>
                                    );
                                }
                            } else {
                                const bandW = finalSvgW / count;
                                const bx = -finalSvgW / 2 + (idx * bandW);

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
                                            <rect x={bx} y={-finalSvgH / 2} width={bandW} height={finalSvgH} fill={bColor} stroke="none" />
                                            {separator}
                                        </g>
                                    );
                                }
                            }

                            return renderRect;
                        })}
                    </g>
                )}

                <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} fill="none" stroke={isValid ? (isOccupied ? "#e0e0e0" : "#4CAF50") : "#e57373"} strokeWidth={1} rx={4} />

                {hasCajas && (
                    <rect x={-finalSvgW / 2 + 3} y={-finalSvgH / 2 + 3} width={6} height={6} fill="white" rx={1} stroke="#ccc" strokeWidth={0.5}>
                        <title>Contiene Cajas</title>
                    </rect>
                )}
                {hasCajas && (
                    <text x={-finalSvgW / 2 + 6} y={-finalSvgH / 2 + 7.5} fontSize={5} textAnchor="middle" fill="#333">📦</text>
                )}

                <g transform={`rotate(${-currentRot})`}>
                    <rect x={-12} y={-5} width={24} height={10} rx={2} fill="rgba(255,255,255,0.85)" />
                    <text x={0} y={2.5} fontSize={8} textAnchor="middle" fill="#1F2D2B" fontWeight="600" style={{ pointerEvents: 'none' }}>{u.id}</text>
                </g>
            </g>
        </React.Fragment>
    );
};
