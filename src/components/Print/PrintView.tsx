import React, { useMemo } from 'react';
import type { Ubicacion } from '../../types';

interface PrintViewProps {
    data: Ubicacion[];
    title?: string;
    mode?: 'list' | 'cards' | 'MAP';
    onClose?: () => void;
}

interface PrintItem {
    material: string;
    tipo: string;
    cantidad: number | string;
    lote: string;
}

interface PrintPageData {
    id: string; // Unique key for the page
    title: string;
    type: 'palet' | 'estanteria';
    items: PrintItem[];
}

export const PrintView: React.FC<PrintViewProps> = ({ data, onClose }) => {
    // We only care about rendering the A4 format which overrides the old list/cards if they just want this A4 view.
    // However, we'll keep it as the default render when PrintView is mounted.

    const pages = useMemo(() => {
        const generatedPages: PrintPageData[] = [];

        // 1. Separate into Pallets and Shelves
        const pallets = data.filter(u => u.tipo === 'palet' || (!u.id.startsWith('E') && !u.tipo?.includes('estanteria')));
        const shelves = data.filter(u => u.tipo === 'estanteria_modulo' || u.id.startsWith('E'));

        // Helper to safely get material name
        const getDesc = (desc: string) => desc || "Material Desconocido";

        // 2. Process Pallets
        // Order pallets numerically or alphabetically
        pallets.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

        pallets.forEach(u => {
            const items: PrintItem[] = [];

            if (u.cajas) {
                u.cajas.forEach(c => {
                    items.push({
                        material: getDesc(c.descripcion),
                        tipo: c.tipoContenedor || 'Caja',
                        cantidad: c.cantidad || 1,
                        lote: c.programa || u.programa || 'Vacio'
                    });
                });
            }
            if (u.materiales) {
                u.materiales.forEach(m => {
                    items.push({
                        material: getDesc(m.nombre),
                        tipo: 'Suelto',
                        cantidad: m.cantidad || 1,
                        lote: m.programa || u.programa || 'Vacio'
                    });
                });
            }

            // Generate the page for this pallet, even if empty (to know it's empty)
            generatedPages.push({
                id: `palet-${u.id}`,
                title: u.id,
                type: 'palet',
                items: items
            });
        });

        // 3. Process Shelves
        shelves.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

        shelves.forEach(u => {
            // Group by Module
            // keys in cajasEstanteria are like "M1-A1", "M2-A3"
            const modules: Record<string, PrintItem[]> = {};

            if (u.cajasEstanteria) {
                Object.entries(u.cajasEstanteria).forEach(([slot, caja]) => {
                    // Extract module, default to '1' if format is weird
                    const match = slot.match(/M(\d+)/);
                    const modNum = match ? match[1] : '1';

                    if (!modules[modNum]) modules[modNum] = [];

                    modules[modNum].push({
                        material: getDesc(caja.descripcion),
                        tipo: caja.tipoContenedor || 'Estantería',
                        cantidad: caja.cantidad || 1,
                        lote: caja.programa || u.programa || 'Vacio'
                    });
                });
            }

            // If the shelf is completely empty but selected, maybe we want to print an empty sheet?
            // Usually we only print modules that have something, or at least Module 1.
            const modKeys = Object.keys(modules).sort((a, b) => parseInt(a) - parseInt(b));

            if (modKeys.length === 0) {
                generatedPages.push({
                    id: `shelf-${u.id}-M1`,
                    title: `${u.id}-1`,
                    type: 'estanteria',
                    items: [] // Empty
                });
            } else {
                modKeys.forEach(mod => {
                    generatedPages.push({
                        id: `shelf-${u.id}-M${mod}`,
                        title: `${u.id}-${mod}`,
                        type: 'estanteria',
                        items: modules[mod]
                    });
                });
            }
        });

        return generatedPages;
    }, [data]);

    return (
        <div className="print-view-container" style={{ width: '100%', minHeight: '100vh', backgroundColor: '#fff', paddingBottom: '50px' }}>
            <div className="no-print" style={{ padding: '20px', display: 'flex', gap: '15px', borderBottom: '2px solid #ccc', marginBottom: '20px' }}>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: '12px 24px',
                        fontSize: '18px',
                        cursor: 'pointer',
                        backgroundColor: '#2E7D32',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                >
                    🖨️ Imprimir todo
                </button>
                <button
                    onClick={() => {
                        if (onClose) onClose();
                        else window.location.reload();
                    }}
                    style={{
                        padding: '12px 24px',
                        fontSize: '18px',
                        cursor: 'pointer',
                        backgroundColor: '#e0e0e0',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '8px'
                    }}
                >
                    ❌ Cerrar Vista Previa
                </button>
            </div>

            <div style={{ color: 'black', background: 'yellow', padding: '20px', fontSize: '24px', fontWeight: 'bold', margin: '20px' }} className="no-print">
                DEBUG: DATA LENGTH: {data.length} | PAGES LENGTH: {pages.length}
            </div>

            {
                pages.map(page => (
                    <div key={page.id} className="print-page">
                        <div className="print-header">
                            <div className="print-title">{page.title}</div>
                            {page.type === 'palet' && (
                                <img src="/palessito.png" alt="Palessito" className="print-palessito" />
                            )}
                        </div>

                        <table className="print-table">
                            <thead>
                                <tr>
                                    <th>MATERIAL</th>
                                    <th>TIPO_ITEM</th>
                                    <th>CANTIDAD</th>
                                    <th>LOTE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.items.length > 0 ? (
                                    page.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{item.material}</td>
                                            <td>{item.tipo}</td>
                                            <td>{item.cantidad}</td>
                                            <td>{item.lote}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                                            Vacío
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ))
            }
        </div >
    );
};

