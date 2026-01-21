import React, { useState, useMemo } from 'react';
import type { Ubicacion, InventoryItem } from './types';

interface PropertiesPanelProps {
    location: Ubicacion;
    onUpdate: (u: Ubicacion) => void;
    onClose: () => void;
    programColors: Record<string, string>;
}

// --- SUB-COMPONENT: INVENTORY LIST MANAGER ---
const InventoryList: React.FC<{
    items: InventoryItem[],
    onUpdate: (items: InventoryItem[]) => void,
    programColors: Record<string, string>,
    defaultProgram: string
}> = ({ items, onUpdate, programColors, defaultProgram }) => {

    // New Item State
    const [newItemType, setNewItemType] = useState<'Caja' | 'Material'>('Caja');
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemQty, setNewItemQty] = useState(1);
    const [newItemProgram, setNewItemProgram] = useState(defaultProgram);

    const handleAdd = () => {
        if (!newItemDesc.trim()) return;
        const newItem: InventoryItem = {
            id: crypto.randomUUID(),
            tipo: newItemType,
            contenido: newItemDesc,
            cantidad: newItemQty,
            programa: newItemProgram
        };
        onUpdate([...items, newItem]);
        setNewItemDesc(''); // Reset desc
        setNewItemQty(1);
    };

    const handleDelete = (id: string) => {
        onUpdate(items.filter(i => i.id !== id));
    };

    return (
        <div style={{ marginTop: 10 }}>
            {/* EXISTING ITEMS LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 15 }}>
                {items.length === 0 && (
                    <div style={{ padding: 10, background: '#f5f5f5', color: '#888', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center' }}>
                        Sin contenido. Añade algo abajo. 👇
                    </div>
                )}
                {items.map(item => (
                    <div key={item.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#fff',
                        border: '1px solid #eee',
                        borderRadius: 6,
                        padding: '6px 10px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ fontSize: '1.2rem' }}>
                            {item.tipo === 'Caja' ? '📦' : '🎾'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.contenido}</div>
                            <div style={{ fontSize: '0.75rem', color: programColors[item.programa] || '#888' }}>{item.programa || item.tipo}</div>
                        </div>

                        {/* Quantity Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 5 }}>
                            <button
                                onClick={() => {
                                    const newQty = Math.max(1, item.cantidad - 1);
                                    onUpdate(items.map(i => i.id === item.id ? { ...i, cantidad: newQty } : i));
                                }}
                                style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}
                            >
                                -
                            </button>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.cantidad}</span>
                            <button
                                onClick={() => {
                                    const newQty = item.cantidad + 1;
                                    onUpdate(items.map(i => i.id === item.id ? { ...i, cantidad: newQty } : i));
                                }}
                                style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}
                            >
                                +
                            </button>
                        </div>

                        <button
                            onClick={() => handleDelete(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '1.1rem' }}
                            title="Eliminar"
                        >
                            🗑️
                        </button>
                    </div>
                ))}
            </div>

            {/* ADD ITEM FORM */}
            <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#166534', marginBottom: 8 }}>Añadir Elemento:</div>

                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                    <select
                        value={newItemType}
                        onChange={(e) => setNewItemType(e.target.value as any)}
                        style={{ padding: 4, borderRadius: 4, border: '1px solid #ddd', flex: 1 }}
                    >
                        <option value="Caja">📦 Caja</option>
                        <option value="Material">🎾 Material</option>
                    </select>
                    <input
                        type="number"
                        min={1}
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(Number(e.target.value))}
                        style={{ width: 50, padding: 4, borderRadius: 4, border: '1px solid #ddd' }}
                    />
                </div>

                <textarea
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    placeholder="Descripción (ej: Balones Nike)"
                    rows={2}
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ddd', marginBottom: 8, fontSize: '0.9rem' }}
                />

                <select
                    value={newItemProgram}
                    onChange={(e) => setNewItemProgram(e.target.value)}
                    style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #ddd', marginBottom: 8, fontSize: '0.85rem' }}
                >
                    {Object.keys(programColors).map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>

                <button
                    onClick={handleAdd}
                    disabled={!newItemDesc.trim()}
                    style={{
                        width: '100%',
                        padding: '6px',
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontWeight: 'bold',
                        cursor: newItemDesc.trim() ? 'pointer' : 'not-allowed',
                        opacity: newItemDesc.trim() ? 1 : 0.6
                    }}
                >
                    + Añadir
                </button>
            </div>
        </div>
    );
};


const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ location, onUpdate, onClose, programColors }) => {

    const handleChange = (field: keyof Ubicacion, value: any) => {
        onUpdate({ ...location, [field]: value });
    };

    // --- SHELF LOGIC ---
    const isShelf = location.tipo === 'estanteria_modulo';

    const moduleCount = useMemo(() => {
        if (!isShelf) return 0;
        return Math.max(1, Math.round(location.width / 1.0));
    }, [location.width, isShelf]);

    const [selectedModule, setSelectedModule] = useState(1);
    const [selectedLevel, setSelectedLevel] = useState(1);

    // --- SHELF ITEMS HANDLER ---
    const handleShelfItemsUpdate = (newItems: InventoryItem[]) => {
        const key = `M${selectedModule}-A${selectedLevel}`;
        const newShelfItems = { ...(location.shelfItems || {}) };
        newShelfItems[key] = newItems;
        handleChange('shelfItems', newShelfItems);
    };

    // Get current items for selected shelf cell
    const currentShelfItems = location.shelfItems?.[`M${selectedModule}-A${selectedLevel}`] || [];


    // --- PALLET ITEMS HANDLER ---
    const handlePalletItemsUpdate = (newItems: InventoryItem[]) => {
        handleChange('items', newItems);
    };

    const currentPalletItems = location.items || [];


    return (
        <div className="properties-panel">
            <div className="properties-header">
                <h2>{isShelf ? 'Estantería Multi-Nivel' : 'Propiedades Palet'}</h2>
                <button className="close-btn" onClick={onClose}>&times;</button>
            </div>

            <div className="properties-content">

                {/* --- HEADER INFO --- */}
                <div className="prop-group">
                    <label>ID Identificador</label>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        #{location.id}
                        {isShelf && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>({moduleCount} Módulos)</span>}
                    </div>
                </div>

                {/* --- PALET EDITOR --- */}
                {!isShelf && (
                    <div className="prop-group">
                        <label>Inventario</label>
                        <InventoryList
                            items={currentPalletItems}
                            onUpdate={handlePalletItemsUpdate}
                            programColors={programColors}
                            defaultProgram={location.programa || "Vacio"}
                        />
                    </div>
                )}

                {/* --- SHELF EDITOR --- */}
                {isShelf && (
                    <div style={{ marginTop: 10 }}>

                        {/* 1. MODULE SELECTOR */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ fontSize: '0.85rem', color: '#666' }}>1. Selecciona Módulo</label>
                            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 5 }}>
                                {Array.from({ length: moduleCount }).map((_, i) => {
                                    const m = i + 1;
                                    const isSel = selectedModule === m;
                                    return (
                                        <button
                                            key={m}
                                            onClick={() => setSelectedModule(m)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '4px',
                                                border: isSel ? '2px solid var(--color-primary)' : '1px solid #ddd',
                                                background: isSel ? 'rgba(0,122,51,0.1)' : '#fff',
                                                fontWeight: isSel ? 'bold' : 'normal',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            M{m}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. LEVEL SELECTOR */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ fontSize: '0.85rem', color: '#666' }}>2. Selecciona Altura</label>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column-reverse',
                                gap: 4,
                                background: '#f5f5f5',
                                padding: 8,
                                borderRadius: 6
                            }}>
                                {[1, 2, 3, 4].map(lvl => {
                                    const isSel = selectedLevel === lvl;
                                    const cellItems = location.shelfItems?.[`M${selectedModule}-A${lvl}`] || [];
                                    const hasContent = cellItems.length > 0;

                                    return (
                                        <div
                                            key={lvl}
                                            onClick={() => setSelectedLevel(lvl)}
                                            style={{
                                                padding: '8px',
                                                borderRadius: '4px',
                                                background: isSel ? 'var(--color-primary)' : (hasContent ? '#dcfce7' : '#fff'),
                                                color: isSel ? '#fff' : '#333',
                                                border: isSel ? 'none' : '1px solid #ddd',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <span style={{ fontWeight: 'bold' }}>Nivel {lvl}</span>
                                            {hasContent && !isSel && <span style={{ fontSize: '0.75rem' }}>📦 {cellItems.length}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. CONTENT EDITOR (Specific for this cell) */}
                        <div className="prop-group">
                            <label style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                Contenido: M{selectedModule} - A{selectedLevel}
                            </label>
                            <InventoryList
                                items={currentShelfItems}
                                onUpdate={handleShelfItemsUpdate}
                                programColors={programColors}
                                defaultProgram="Vacio"
                            />
                        </div>
                    </div>
                )}


                {/* --- ADVANCED --- */}
                <div style={{ marginTop: 24, padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                    <details>
                        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                            ⚙️ Opciones Técnicas
                        </summary>
                        <div style={{ marginTop: 12 }}>
                            <div className="prop-group">
                                <label>Rotación (Grados)</label>
                                <input
                                    type="number"
                                    value={Math.round(location.rotation)}
                                    onChange={(e) => handleChange('rotation', Number(e.target.value))}
                                />
                            </div>
                        </div>
                    </details>
                </div>

            </div>
        </div>
    );
};

export default PropertiesPanel;
