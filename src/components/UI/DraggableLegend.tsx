import React from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

interface DraggableLegendProps {
    programColors: Record<string, string>;
}

export const DraggableLegend: React.FC<DraggableLegendProps> = ({ programColors }) => {
    // Initial position (bottom right-ish)
    const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }));

    const bind = useDrag(({ offset: [ox, oy] }) => {
        api.start({ x: ox, y: oy });
    }, {
        // Prevent dragging when interacting with internal elements if needed? Nah.
    });

    return (
        <animated.div
            {...bind()}
            style={{
                x,
                y,
                position: 'absolute',
                bottom: 100,
                right: 20,
                backgroundColor: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 900,
                cursor: 'grab',
                touchAction: 'none',
                minWidth: '450px', // Más ancha
                maxWidth: '600px',
                border: '1px solid #eee'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Mapa de Estado
                </h4>
                <div style={{ fontSize: '10px', color: '#ccc' }}>↔</div>
            </div>

            {/* Status Section (Level 1) */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4CAF50' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>Libre</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F44336' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>Ocupado</span>
                </div>
            </div>

            {/* Programs Section (Level 2 - Horizontal) */}
            <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Programas
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
                {Object.entries(programColors)
                    .filter(([name]) => !['Vacio', 'Otros'].includes(name))
                    .map(([name, color]) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: 12, height: 4, background: color, borderRadius: 2 }}></div>
                            <span style={{ fontSize: '11px', color: '#333', whiteSpace: 'nowrap' }}>{name}</span>
                        </div>
                    ))}
            </div>
        </animated.div>
    );
};
