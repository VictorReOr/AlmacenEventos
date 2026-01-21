import React, { useState } from 'react';
import type { Ubicacion, Programa, ItemInventario, Caja, Material } from './types';

interface PropertiesPanelProps {
    location: Ubicacion;
    onUpdate: (u: Ubicacion) => void;
    onClose: () => void;
    programColors: Record<string, string>;
}

// --- HELPER COMPONENTS ---

const ItemList: React.FC<{
    items: ItemInventario[];
    onUpdateItems: (items: ItemInventario[]) => void;
}> = ({ items, onUpdateItems }) => {

    // Add New Item
    const handleAddItem = (type: 'material' | 'caja') => {
        const newItem: ItemInventario = type === 'material'
            ? { id: Date.now().toString(), nombre: 'Nuevo Material', cantidad: 1, unidad: 'uds' }
            : { id: Date.now().toString(), nombre: 'Nueva Caja', contenido: [] };

        onUpdateItems([...items, newItem]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        onUpdateItems(newItems);
    };

    const handleUpdateItem = (index: number, updated: ItemInventario) => {
        const newItems = [...items];
        newItems[index] = updated;
        onUpdateItems(newItems);
    };

    return (
        <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                <button
                    onClick={() => handleAddItem('caja')}
                    style={{ flex: 1, padding: '6px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd', background: '#fff' }}
                >+ Caja</button>
                <button
                    onClick={() => handleAddItem('material')}
                    style={{ flex: 1, padding: '6px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd', background: '#fff' }}
                >+ Material</button>
            </div>

            {items.length === 0 && <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem' }}>Vacío</div>}

            {items.map((item, idx) => (
                <div key={item.id} style={{ border: '1px solid var(--color-border)', padding: 8, marginBottom: 8, borderRadius: 6, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>
                            {'contenido' in item ? '📦 CAJA' : '🔩 MATERIAL'}
                        </span>
                        <button onClick={() => handleRemoveItem(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>&times;</button>
                    </div>

                    {/* EDIT NAME */}
                    <input
                        type="text"
                        value={item.nombre}
                        onChange={(e) => handleUpdateItem(idx, { ...item, nombre: e.target.value })}
                        style={{ width: '100%', marginBottom: 5, fontSize: '0.9rem', padding: '4px', border: '1px solid #eee', borderRadius: '4px' }}
                    />

                    {/* IF MATERIAL: SHOW QTY */}
                    {!('contenido' in item) && (
                        <div style={{ display: 'flex', gap: 5 }}>
                            <input
                                type="number"
                                value={(item as Material).cantidad}
                                onChange={(e) => handleUpdateItem(idx, { ...item, cantidad: Number(e.target.value) })}
                                style={{ width: 60, fontSize: '0.9rem', padding: '4px', border: '1px solid #eee', borderRadius: '4px' }}
                            />
                            <input
                                type="text"
                                value={(item as Material).unidad || ''}
                                onChange={(e) => handleUpdateItem(idx, { ...item, unidad: e.target.value })}
                                placeholder="uds"
                                style={{ width: 50, fontSize: '0.9rem', padding: '4px', border: '1px solid #eee', borderRadius: '4px' }}
                            />
                        </div>
                    )}

                    {/* IF BOX: RECURSIVE LIST */}
                    {'contenido' in item && (
                        <div style={{ paddingLeft: 10, borderLeft: '2px solid #f3f4f6' }}>
                            <ItemList
                                items={(item as Caja).contenido}
                                onUpdateItems={(newContent) => handleUpdateItem(idx, { ...item, contenido: newContent } as Caja)}
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};


// --- MAIN PANEL ---

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ location, onUpdate, onClose, programColors }) => {

    // For Shelves: Selected Level State
    const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4>(1);

    const handleChange = (field: keyof Ubicacion, value: any) => {
        onUpdate({ ...location, [field]: value });
    };

    // Update Levels helper
    const handleUpdateLevel = (levelNum: number, newItems: ItemInventario[]) => {
        if (!location.niveles) return;
        const newLevels = location.niveles.map(l =>
            l.nivel === levelNum ? { ...l, items: newItems } : l
        );
        handleChange('niveles', newLevels);
    };

    // Update Pallet Items helper
    const handleUpdatePalletItems = (newItems: ItemInventario[]) => {
        handleChange('items', newItems);
    };

    return (
        <div className="properties-panel">
            <div className="properties-header">
                <h2>{location.tipo === 'estanteria_modulo' ? 'Estantería' : 'Propiedades'}</h2>
                <button className="close-btn" onClick={onClose}>&times;</button>
            </div>

            <div className="properties-content">

                {/* --- HEADER INFO --- */}
                <div className="prop-group">
                    <label>ID Identificador</label>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                        #{location.id}
                    </div>
                </div>

                {location.tipo !== 'estanteria_modulo' && (
                    <div className="prop-group">
                        <label>Programa / Estado</label>
                        <select
                            value={location.programa}
                            onChange={(e) => handleChange('programa', e.target.value as Programa)}
                        >
                            {Object.keys(programColors).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* --- ESTANTERÍA VISUALIZER (Option B) --- */}
                {location.tipo === 'estanteria_modulo' && location.niveles && (
                    <div className="prop-group">
                        <label>Niveles (Seleccionar)</label>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column-reverse', // Level 1 at bottom
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: '#f9fafb',
                            marginTop: 5
                        }}>
                            {[1, 2, 3, 4].map((lvl) => {
                                const levelData = location.niveles?.find(l => l.nivel === lvl);
                                const itemCount = levelData?.items.length || 0;
                                const isSelected = selectedLevel === lvl;

                                return (
                                    <div
                                        key={lvl}
                                        onClick={() => setSelectedLevel(lvl as any)}
                                        style={{
                                            height: 40,
                                            borderTop: lvl === 4 ? 'none' : '1px solid #e5e7eb',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0 12px',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(0, 122, 51, 0.1)' : 'transparent',
                                            color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)',
                                            fontWeight: isSelected ? 600 : 400,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <span>Nivel {lvl}</span>
                                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* --- INVENTORY LIST --- */}
                <div style={{ marginTop: 24, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                    <label style={{ fontWeight: 600, color: 'var(--color-text-main)', display: 'block', marginBottom: 8 }}>
                        {location.tipo === 'estanteria_modulo'
                            ? `Contenido Nivel ${selectedLevel}`
                            : 'Contenido / Carga'
                        }
                    </label>

                    {location.tipo === 'estanteria_modulo' && location.niveles ? (
                        <ItemList
                            items={location.niveles.find(l => l.nivel === selectedLevel)?.items || []}
                            onUpdateItems={(items) => handleUpdateLevel(selectedLevel, items)}
                        />
                    ) : (
                        <ItemList
                            items={location.items || []}
                            onUpdateItems={handleUpdatePalletItems}
                        />
                    )}
                </div>

                {/* Legacy Fields (Hidden for shelves or minimized) */}
                <div style={{ marginTop: 24, padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                    <details>
                        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                            ⚙️ Opciones Avanzadas
                        </summary>
                        <div style={{ marginTop: 12 }}>
                            <div className="prop-group">
                                <label>Notas Adicionales</label>
                                <textarea
                                    rows={3}
                                    value={location.notas || ''}
                                    onChange={(e) => handleChange('notas', e.target.value)}
                                    placeholder="Escribe aquí..."
                                />
                            </div>
                            <div className="prop-row">
                                <div className="prop-group">
                                    <label>Rotación (Grados)</label>
                                    <input
                                        type="number"
                                        value={Math.round(location.rotation)}
                                        onChange={(e) => handleChange('rotation', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>
                    </details>
                </div>

            </div>
        </div>
    );
};

export default PropertiesPanel;
