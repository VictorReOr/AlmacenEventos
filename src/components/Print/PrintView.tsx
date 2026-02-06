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

        // 0. Shelf Slots
        if (u.cajasEstanteria && Object.keys(u.cajasEstanteria).length > 0) {
            const sortedKeys = Object.keys(u.cajasEstanteria).sort((a, b) => {
                try {
                    const [m_a, a_a] = a.replace('M', '').split('-A').map(Number);
                    const [m_b, a_b] = b.replace('M', '').split('-A').map(Number);
                    if (m_a !== m_b) return m_a - m_b;
                    return a_a - a_b;
                } catch (e) {
                    return a.localeCompare(b);
                }
            });

            sortedKeys.forEach((key) => {
                const caja = u.cajasEstanteria![key];
                const fancyLoc = key.replace('M', 'Mód ').replace('A', 'Alt ');

                items.push(
                    <div key={`shelf-${key}`} className="print-item">
                        <strong className="print-location-tag">[{fancyLoc}]</strong> {caja.descripcion}
                        {caja.contenido && caja.contenido.length > 0 && (
                            <ul className="print-sublist">
                                {caja.contenido.map((m, mIdx) => (
                                    <li key={mIdx}>{m.nombre} (x{m.cantidad})</li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            });
        }

        // 1. Boxes
        if (u.cajas && u.cajas.length > 0) {
            u.cajas.forEach((caja, idx) => {
                items.push(
                    <div key={`box-${idx}`} className="print-item">
                        <strong className="print-box-title">[Caja] {caja.descripcion}</strong> {caja.cantidad ? `(x${caja.cantidad})` : ''}
                        {caja.contenido && caja.contenido.length > 0 && (
                            <ul className="print-sublist">
                                {caja.contenido.map((m, mIdx) => (
                                    <li key={mIdx}>{m.nombre} (x{m.cantidad})</li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            });
        }

        // 2. Loose Materials
        if (u.materiales && u.materiales.length > 0) {
            u.materiales.forEach((m, idx) => {
                items.push(
                    <div key={`mat-${idx}`} className="print-item print-loose-item">
                        <strong>[Suelto]</strong> {m.nombre} (x{m.cantidad})
                    </div>
                );
            });
        }

        // 3. Last Resort
        if (items.length === 0) {
            if (u.contenido) return <div>{u.contenido}</div>;
            return <span className="print-empty">Vacío</span>;
        }

        return items;
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
                            <td className="print-cell-id">{u.id}</td>
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
