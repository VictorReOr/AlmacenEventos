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

        // 0. Shelf Slots (Legacy & New Logic) - PRIORIDAD para Estanterías
        if (u.cajasEstanteria && Object.keys(u.cajasEstanteria).length > 0) {
            // Sort keys to be orderly: M1-A1, M1-A2, M1-A3...
            const sortedKeys = Object.keys(u.cajasEstanteria).sort((a, b) => {
                // Heurística simple: string comparison funciona bien para "M1-A1" vs "M1-A2"
                // Pero para "M1-A10" vs "M1-A2", falla. Mejor parsear.
                try {
                    const [m_a, a_a] = a.replace('M', '').split('-A').map(Number);
                    const [m_b, a_b] = b.replace('M', '').split('-A').map(Number);
                    if (m_a !== m_b) return m_a - m_b;
                    return a_a - a_b; // Ordenar por altura ascendente (suelo a techo) o descendente?
                    // Normalmente visualmente leemos de arriba a abajo en lista, pero estantería es físico.
                    // Ascendente (1, 2, 3) es lógico.
                } catch (e) {
                    return a.localeCompare(b);
                }
            });

            sortedKeys.forEach((key) => {
                const caja = u.cajasEstanteria![key];
                // Parse key for display: "M1-A1" -> "Módulo 1 - Altura 1"
                const fancyLoc = key.replace('M', 'Mód ').replace('A', 'Alt ');

                items.push(
                    <div key={`shelf-${key}`} style={{ marginBottom: '4px', borderBottom: '1px dashed #eee', paddingBottom: '2px' }}>
                        <strong style={{ color: '#00796B' }}>[{fancyLoc}]</strong> {caja.descripcion}
                        {caja.contenido && caja.contenido.length > 0 && (
                            <ul style={{ margin: '2px 0 0 15px', padding: 0, listStyleType: 'square', fontSize: '0.9em' }}>
                                {caja.contenido.map((m, mIdx) => (
                                    <li key={mIdx}>{m.nombre} (x{m.cantidad})</li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            });
        }

        // 1. Boxes (Cajas - Pallets)
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

        // 2. Loose Materials (Materiales Sueltos - Pallets)
        if (u.materiales && u.materiales.length > 0) {
            u.materiales.forEach((m, idx) => {
                items.push(
                    <div key={`mat-${idx}`} style={{ marginBottom: '4px', color: '#E65100' }}>
                        <strong>[Suelto]</strong> {m.nombre} (x{m.cantidad})
                    </div>
                );
            });
        }

        // 3. Last Resort: Simple Label or Empty
        if (items.length === 0) {
            if (u.contenido) return <div>{u.contenido}</div>;
            return <span style={{ color: '#999', fontStyle: 'italic' }}>Vacío</span>;
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
