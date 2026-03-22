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
    const bandsToShow = displayPrograms
        .filter(p => p && p !== 'Vacio' && p !== 'vacio')
        .slice(0, maxBands);
    const showOverflow = displayPrograms.filter(p => p && p !== 'Vacio').length > maxBands;

    const hasCajas = u.cajas && u.cajas.length > 0;
    const hasMaterial = u.materiales && u.materiales.length > 0;
    const isOccupied = hasCajas || hasMaterial;

    let isDimmed = false;
    if (activeFilter) {
        isDimmed = !displayPrograms.some(prog => prog === activeFilter);
    }
    const isHighlighted = activeFilter && !isDimmed;
    const activeColor = activeFilter ? (programColors[activeFilter] || programColors['Otros'] || '#ff9800') : '#ff9800';

    // Unique SVG IDs
    const clipId      = `clip-${u.id}`;
    const bodyGradId  = `bodyg-${u.id}`;

    const glossId     = `gloss-${u.id}`;
    const emptyPatId  = `emp-${u.id}`;

    const rx = 5;

    // ── Band area: full pallet height ──
    const bandAreaTop    = -finalSvgH / 2;
    const bandAreaHeight = finalSvgH;

    const normRot          = Math.abs(currentRot % 180);
    const isVerticalOnScr  = normRot > 45 && normRot < 135;

    // Build band rects — use actual program count for sizing
    const visibleBands = bandsToShow.filter(prog => {
        const bColor = programColors[prog] || '#e0e0e0';
        return bColor !== '#e0e0e0';
    });
    const bandCount = visibleBands.length || 1;
    const p = 2.5; // inner padding per band

    const renderBands = () => {
        if (!isOccupied || visibleBands.length === 0) return null;

        return (
            <g clipPath={`url(#${clipId})`}>
                {visibleBands.map((prog, idx) => {
                    const bColor = programColors[prog] || '#e0e0e0';
                    const isLast = idx === visibleBands.length - 1 && showOverflow;

                    if (isVerticalOnScr) {
                        // Bands stacked left-to-right
                        const bandW = finalSvgW / bandCount;
                        const bx = -finalSvgW / 2 + idx * bandW;
                        if (isLast) return (
                            <g key={idx}>
                                <rect x={bx + p} y={bandAreaTop + p} width={bandW - p * 2} height={bandAreaHeight - p * 2} fill="#f0f0f0" rx={3} />
                                {[-6, 0, 6].map(cy => <circle key={cy} cx={bx + bandW / 2} cy={bandAreaTop + bandAreaHeight / 2 + cy} r={2} fill="#888" />)}
                            </g>
                        );
                        return (
                            <g key={idx}>
                                {/* Base band */}
                                <rect x={bx + p} y={bandAreaTop + p} width={bandW - p * 2} height={bandAreaHeight - p * 2} fill={bColor} rx={3} />
                                {/* Gloss */}
                                <rect x={bx + p + 0.5} y={bandAreaTop + p + 0.5} width={bandW - p * 2 - 1} height={(bandAreaHeight - p * 2) * 0.45} fill={`url(#${glossId})`} rx={3} style={{ pointerEvents: 'none' }} />
                                {/* Separator */}
                                {idx < bandCount - 1 && <line x1={bx + bandW} y1={bandAreaTop} x2={bx + bandW} y2={bandAreaTop + bandAreaHeight} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />}
                            </g>
                        );
                    } else {
                        // Bands stacked top-to-bottom (within the band area)
                        const bandH = bandAreaHeight / bandCount;
                        const by = bandAreaTop + idx * bandH;
                        if (isLast) return (
                            <g key={idx}>
                                <rect x={-finalSvgW / 2 + p} y={by + p} width={finalSvgW - p * 2} height={bandH - p * 2} fill="#f0f0f0" rx={3} />
                                {[-finalSvgW / 4, 0, finalSvgW / 4].map(cx => <circle key={cx} cx={cx} cy={by + bandH / 2} r={2} fill="#888" />)}
                            </g>
                        );
                        return (
                            <g key={idx}>
                                {/* Base band */}
                                <rect x={-finalSvgW / 2 + p} y={by + p} width={finalSvgW - p * 2} height={bandH - p * 2} fill={bColor} rx={3} />
                                {/* Gloss */}
                                <rect x={-finalSvgW / 2 + p + 0.5} y={by + p + 0.5} width={finalSvgW - p * 2 - 1} height={(bandH - p * 2) * 0.45} fill={`url(#${glossId})`} rx={3} style={{ pointerEvents: 'none' }} />
                                {/* Separator */}
                                {idx < bandCount - 1 && <line x1={-finalSvgW / 2} y1={by + bandH} x2={finalSvgW / 2} y2={by + bandH} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />}
                            </g>
                        );
                    }
                })}
            </g>
        );
    };

    return (
        <React.Fragment>
            <defs>
                {/* Clip to rounded body */}
                <clipPath id={clipId}>
                    <rect x={-finalSvgW / 2} y={-finalSvgH / 2} width={finalSvgW} height={finalSvgH} rx={rx} />
                </clipPath>

                {/* WOOD/BOX body gradient — warm honey-brown tones */}
                <linearGradient id={bodyGradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={isOccupied ? "#E8D5B0" : "#F0E8D5"} />
                    <stop offset="100%" stopColor={isOccupied ? "#C8A870" : "#DDD0B0"} />
                </linearGradient>



                {/* Gloss for bands */}
                <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="rgba(255,255,255,0.42)" />
                    <stop offset="60%"  stopColor="rgba(255,255,255,0.06)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.03)" />
                </linearGradient>

                {/* Empty slot hatch — green diagonal lines */}
                <pattern id={emptyPatId} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(0,100,0,0.12)" strokeWidth="2.5" />
                </pattern>
            </defs>

            <g
                className={isHighlighted ? 'aura-highlight' : ''}
                style={{
                    '--aura-color': activeColor,
                    opacity: isDimmed ? 0.15 : (Number(u.depth) === 0.3 ? 0.6 : 1),
                    filter: isDimmed ? 'grayscale(80%)' : undefined,
                    transition: 'opacity 0.2s, filter 0.2s'
                } as React.CSSProperties}
            >
                {/* ── SELECTION GLOW ── */}
                {isSelected && (
                    <rect
                        x={-finalSvgW / 2 - 4} y={-finalSvgH / 2 - 4}
                        width={finalSvgW + 8} height={finalSvgH + 8}
                        fill="none" stroke={C_VERDE} strokeWidth={2.5} rx={rx + 2}
                        style={{ filter: 'drop-shadow(0 0 5px #4CAF50)', animation: 'selPulse 1.4s ease-in-out infinite alternate' }}
                    />
                )}

                {/* ── BODY (wood/crate look) ── */}
                <rect
                    x={-finalSvgW / 2} y={-finalSvgH / 2}
                    width={finalSvgW} height={finalSvgH}
                    fill={`url(#${bodyGradId})`}
                    stroke={isValid ? (isOccupied ? "#A0845A" : "#4CAF50") : "#e57373"}
                    strokeWidth={isOccupied ? 1.5 : 2}
                    rx={rx}
                    style={{ filter: 'drop-shadow(0px 3px 5px rgba(0,0,0,0.20))' }}
                />

                {/* ── EMPTY SLOT HATCH ── */}
                {!isOccupied && (
                    <rect
                        x={-finalSvgW / 2} y={-finalSvgH / 2}
                        width={finalSvgW} height={finalSvgH}
                        fill={`url(#${emptyPatId})`}
                        rx={rx}
                        style={{ pointerEvents: 'none' }}
                    />
                )}

                {/* ── PROGRAM COLOR BANDS (below the tab) ── */}
                {renderBands()}



                {/* ── BOX INDICATOR ── */}
                {hasCajas && (
                    <>
                        <rect x={-finalSvgW / 2 + 3} y={-finalSvgH / 2 + 1.5} width={6} height={6} fill="rgba(255,255,255,0.85)" rx={1} stroke="#ccc" strokeWidth={0.5}>
                            <title>Contiene Cajas</title>
                        </rect>
                        <text x={-finalSvgW / 2 + 6} y={-finalSvgH / 2 + 6.5} fontSize={5} textAnchor="middle" fill="#333">📦</text>
                    </>
                )}

                {/* ── ID LABEL PILL (always on top, rotated to face screen) ── */}
                <g transform={`rotate(${-currentRot})`}>
                    <rect x={-13} y={-5} width={26} height={11} rx={3}
                        fill="rgba(255,250,240,0.93)" stroke="rgba(100,60,0,0.25)" strokeWidth={0.8} />
                    <text x={0} y={3} fontSize={8} textAnchor="middle"
                        fill="#3E2000" fontWeight="700" style={{ pointerEvents: 'none' }}>
                        {u.id}
                    </text>
                </g>
            </g>
        </React.Fragment>
    );
};
