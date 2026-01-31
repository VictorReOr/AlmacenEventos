import React from 'react';
import type { InventoryError } from '../../utils/inventoryValidation';

interface InventoryErrorsModalProps {
    errors: InventoryError[];
    onClose: () => void;
}

export const InventoryErrorsModal: React.FC<InventoryErrorsModalProps> = ({ errors, onClose }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

            <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                width: '600px',
                maxWidth: '90vw',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#ffebee' // Light Red
                }}>
                    <h3 style={{ margin: 0, color: '#d32f2f', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        ⚠️ Reporte de Conflictos ({errors.length})
                    </h3>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666'
                    }}>×</button>
                </div>

                {/* Content */}
                <div style={{ padding: '20px', overflowY: 'auto' }}>
                    <p style={{ marginTop: 0, color: '#666', fontSize: '0.9rem' }}>
                        Se han detectado los siguientes errores en los datos del inventario (Hoja de Cálculo).
                        Estos ítems tienen coordenadas imposibles y <b>no se están mostrando en el mapa</b> para evitar errores visuales.
                    </p>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '10px', fontSize: '0.85rem' }}>Ubicación</th>
                                <th style={{ padding: '10px', fontSize: '0.85rem' }}>Detalle del Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {errors.map((err, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '10px', verticalAlign: 'top', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                        {err.shelfId}
                                    </td>
                                    <td style={{ padding: '10px', color: '#d32f2f', fontSize: '0.9rem' }}>
                                        {err.details}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: '20px', padding: '10px', background: '#e3f2fd', borderRadius: '4px', fontSize: '0.85rem', color: '#0d47a1' }}>
                        ℹ️ <b>Solución:</b> Ve a la Hoja de Cálculo de Inventario y corrige las coordenadas de estos ítems para que correspondan con los módulos reales de cada estantería.
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '15px 20px',
                    borderTop: '1px solid #eee',
                    textAlign: 'right'
                }}>
                    <button onClick={onClose} style={{
                        padding: '8px 16px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}>
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};
