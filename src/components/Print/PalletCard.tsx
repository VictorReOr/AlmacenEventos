import React from 'react';
import type { Ubicacion } from '../../types';
import { PROGRAM_COLORS } from '../../types';

interface PalletCardProps {
    data: Ubicacion;
}

export const PalletCard: React.FC<PalletCardProps> = ({ data }) => {

    // Helper to get color
    const baseColor = PROGRAM_COLORS[data.programa] || '#999';

    // Helper to consolidate items for display
    const getConsolidatedItems = () => {
        const items: { name: string; qty: number; type: 'box' | 'loose' }[] = [];

        // Boxes
        if (data.cajas) {
            data.cajas.forEach(c => {
                items.push({
                    name: c.descripcion,
                    qty: c.cantidad || 1,
                    type: 'box'
                });
            });
        }

        // Loose
        if (data.materiales) {
            data.materiales.forEach(m => {
                items.push({
                    name: m.nombre,
                    qty: m.cantidad,
                    type: 'loose'
                });
            });
        }

        return items;
    };

    const items = getConsolidatedItems();

    return (
        <div className="pallet-card" style={{
            border: `4px solid ${baseColor}`,
            borderRadius: '8px',
            padding: '16px',
            margin: '10px 0',
            pageBreakInside: 'avoid',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>#{data.id}</span>
                    <span style={{ fontSize: '1.2rem', color: '#666' }}>{data.tipo === 'estanteria_modulo' ? 'Estantería' : 'Palet'}</span>
                </div>
                <div style={{
                    backgroundColor: baseColor,
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}>
                    {data.programa}
                </div>
            </div>

            {/* Description */}
            <div style={{ fontSize: '1.4rem', fontWeight: '500' }}>
                {data.contenido || "Sin Descripción"}
            </div>

            {/* Content List */}
            <div style={{ flex: 1, border: '1px solid #eee', borderRadius: '4px', padding: '8px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', textTransform: 'uppercase', color: '#888' }}>Contenido</h3>
                {items.length === 0 ? (
                    <div style={{ color: '#ccc', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>Vacío</div>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {items.map((item, idx) => (
                            <li key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '6px 0',
                                borderBottom: idx < items.length - 1 ? '1px dashed #eee' : 'none',
                                fontSize: '1.1rem'
                            }}>
                                <span style={{ marginRight: '8px', fontSize: '1.2rem' }}>
                                    {item.type === 'box' ? '📦' : '🔹'}
                                </span>
                                <span style={{ flex: 1 }}>{item.name}</span>
                                <span style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>
                                    x{item.qty}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Footer / Metadata */}
            <div style={{ fontSize: '0.8rem', color: '#aaa', textAlign: 'right', marginTop: 'auto' }}>
                Ubicación: {data.x.toFixed(0)}, {data.y.toFixed(0)} | W: {data.width} | D: {data.depth}
            </div>
        </div>
    );
};
