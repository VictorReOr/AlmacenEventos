import React from 'react';

interface DraggableLegendProps {
    programColors: Record<string, string>;
    isMobile?: boolean;
}

export const DraggableLegend: React.FC<DraggableLegendProps> = ({ programColors, isMobile }) => {
    // Mobile Style (Static, Full Width, Scrollable)
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
                    // Hide Scrollbar
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }}
            >
                {/* State Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4CAF50' }}></div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>Libre</span>
                </div>

                <div style={{ width: 1, height: 16, backgroundColor: '#ccc', flexShrink: 0 }}></div>

                {/* Programs Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {Object.entries(programColors)
                        .filter(([name]) => !['Vacio'].includes(name))
                        .map(([name, color]) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <div style={{ width: 16, height: 6, background: color, borderRadius: 2 }}></div>
                                <span style={{ fontSize: '11px', color: '#444' }}>{name}</span>
                            </div>
                        ))}
                </div>
            </div>
        );
    }

    // Desktop/Floating Style
    return (
        <div
            style={{
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)', // Access Center
                backgroundColor: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)', // Slightly stronger shadow for floating element
                zIndex: 900,
                border: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                whiteSpace: 'nowrap' // Prevent wrapping if possible
            }}
        >
            {/* State Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4CAF50' }}></div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>Libre</span>
            </div>

            {/* Vertical Divider */}
            <div style={{ width: 1, height: 16, backgroundColor: '#ccc' }}></div>

            {/* Programs Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {Object.entries(programColors)
                    .filter(([name]) => !['Vacio'].includes(name))
                    .map(([name, color]) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: 16, height: 6, background: color, borderRadius: 2 }}></div>
                            <span style={{ fontSize: '12px', color: '#444' }}>{name}</span>
                        </div>
                    ))}
            </div>
        </div>
    );
};
