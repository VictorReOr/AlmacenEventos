import React, { useState } from 'react';
import { Palette } from 'lucide-react';

interface DraggableLegendProps {
    programColors: Record<string, string>;
    isMobile?: boolean;
    activeFilter?: string | null;
    onFilterClick?: (filter: string | null) => void;
}

export const DraggableLegend: React.FC<DraggableLegendProps> = ({ programColors, isMobile, activeFilter, onFilterClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    // Estilo Móvil (Estático, Ancho Completo, Desplazable)
    if (isMobile) {
        return (
            <div
                style={{
                    backgroundColor: 'white',
                    padding: '8px 12px',
                    borderTop: '1px solid #e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    whiteSpace: 'nowrap',
                    overflowX: 'auto',
                    width: '100%',
                    // Ocultar Barra de Desplazamiento
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }}
            >
                {/* Sección de Estado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4CAF50' }}></div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>Libre</span>
                </div>

                <div style={{ width: 1, height: 16, backgroundColor: '#ccc', flexShrink: 0 }}></div>

                {/* Sección de Programas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {Object.entries(programColors)
                        .filter(([name]) => !['Vacio'].includes(name))
                        .map(([name, color]) => {
                            const isActive = activeFilter === name;
                            const isInactive = activeFilter && activeFilter !== name;

                            return (
                                <div
                                    key={name}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        flexShrink: 0,
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: isActive ? '#f0f8ff' : 'transparent',
                                        border: isActive ? '1px solid #4CAF50' : '1px solid transparent',
                                        opacity: isInactive ? 0.4 : 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => onFilterClick && onFilterClick(isActive ? null : name)}
                                >
                                    <div style={{ width: 16, height: 6, background: color, borderRadius: 2 }}></div>
                                    <span style={{ fontSize: '11px', color: '#444' }}>{name}</span>
                                </div>
                            );
                        })}
                </div>
            </div>
        );
    }

    // Estilo de Escritorio/Flotante — Smart Legend (Colapsable)
    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'fixed',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)', 
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                padding: isHovered ? '10px 20px' : '8px 16px',
                borderRadius: '30px',
                boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.1)', 
                zIndex: 900,
                border: '1px solid rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                whiteSpace: 'nowrap',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: isHovered ? 'default' : 'pointer',
                overflow: 'hidden'
            }}
        >
            {/* Vista Contraída */}
            {!isHovered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Palette size={16} color="#666" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#555' }}>Leyenda de Colores</span>
                </div>
            )}

            {/* Vista Expandida */}
            {isHovered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', animation: 'fadeIn 0.3s ease-in-out' }}>
                    {/* Sección de Estado */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4CAF50' }}></div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>Libre</span>
                    </div>

                    {/* Divisor Vertical */}
                    <div style={{ width: 1, height: 16, backgroundColor: '#ccc' }}></div>

                    {/* Sección de Programas */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {Object.entries(programColors)
                            .filter(([name]) => !['Vacio'].includes(name))
                            .map(([name, color]) => {
                                const isActive = activeFilter === name;
                                const isInactive = activeFilter && activeFilter !== name;

                                return (
                                    <div
                                        key={name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            cursor: 'pointer',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            background: isActive ? '#f0f8ff' : 'transparent',
                                            border: isActive ? '1px solid #4CAF50' : '1px solid transparent',
                                            opacity: isInactive ? 0.4 : 1,
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={() => onFilterClick && onFilterClick(isActive ? null : name)}
                                    >
                                        <div style={{ width: 16, height: 6, background: color, borderRadius: 2 }}></div>
                                        <span style={{ fontSize: '12px', color: '#444' }}>{name}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
};

