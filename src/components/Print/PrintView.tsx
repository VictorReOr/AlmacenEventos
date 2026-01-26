import React from 'react';
import type { Ubicacion } from '../../types';

interface PrintViewProps {
    data: Ubicacion[];
    title?: string;
}

export const PrintView: React.FC<PrintViewProps> = ({ data, title = "Inventario de Almacén" }) => {

    // Sort logic could go here (e.g. alphanumeric by ID)
    const sortedData = [...data].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    const renderContents = (u: Ubicacion) => {
        const items: JSX.Element[] = [];

        // 1. Boxes (Cajas)
        if (u.cajas && u.cajas.length > 0) {
            u.cajas.forEach((caja, idx) => {
                items.push(
                    <div key={`box-${idx}`} style={{ marginBottom: '4px' }}>
                        <strong>[Caja] {caja.descripcion}</strong> {caja.cantidad ? `(x${caja.cantidad})` : ''}
                        {caja.contenido && caja.contenido.length > 0 && (
                            <ul style={{ margin: '2px 0 0 15px', padding: 0, listStyleType: 'circle' }}>
                                {caja.contenido.map((m, mIdx) => (
                                    <li key={mIdx}>{m.nombre} (x{m.cantidad})</li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            });
        }

        // 2. Loose Materials (Materiales Sueltos)
        if (u.materiales && u.materiales.length > 0) {
            u.materiales.forEach((m, idx) => {
                items.push(
                    <div key={`mat-${idx}`} style={{ marginBottom: '4px', color: '#E65100' }}>
                        <strong>[Suelto]</strong> {m.nombre} (x{m.cantidad})
                    </div>
                );
            });
        }

        // 3. Simple Label (Legacy/Fallback)
        if (items.length === 0 && u.contenido) {
            return <div>{u.contenido}</div>;
        }

        return items.length > 0 ? items : <span style={{ color: '#999', fontStyle: 'italic' }}>Vacío</span>;
    };

    return (
        <div className="print-view-container">
            <div className="print-header">
                <h1>{title}</h1>
                <p>Fecha de impresión: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
            </div>

            <table className="print-table">
                <thead>
                    <tr>
                        <th style={{ width: '15%' }}>ID Ubicación</th>
                        <th style={{ width: '15%' }}>Programa</th>
                        <th style={{ width: '15%' }}>Tipo</th>
                        <th style={{ width: '55%' }}>Contenido</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map(u => (
                        <tr key={u.id}>
                            <td style={{ fontWeight: 'bold' }}>{u.id}</td>
                            <td>{u.programa}</td>
                            <td>{u.tipo}</td>
                            <td>{renderContents(u)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
