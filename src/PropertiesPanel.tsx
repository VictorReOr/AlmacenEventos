import React, { useState, useMemo } from 'react';
import type { Ubicacion, Caja, MaterialEnCaja } from './types';
import styles from './components/UI/PropertiesPanel.module.css';

interface PropertiesPanelProps {
    location: Ubicacion;
    onUpdate: (u: Ubicacion) => void;
    onClose: () => void;
    programColors: Record<string, string>;
    onAssistantAction: (action: { type: string, payload: any }) => void;
}

// --- UNIFIED ITEM CARD ---
// Represents either a Box (Caja) or a Loose Item (MaterialEnCaja)
interface UnifiedItem {
    id: string;
    type: 'box' | 'loose';
    name: string;
    qty: number;
    program: string;
    originalRef: Caja | MaterialEnCaja;
}

const ItemCard: React.FC<{
    item: UnifiedItem;
    onUpdateQty: (newQty: number) => void;
    onUpdateName: (newName: string) => void;
    onDelete: () => void;
    programColors: Record<string, string>;
}> = ({ item, onUpdateQty, onUpdateName, onDelete, programColors }) => {

    // Auto-detect icon based on type or name
    const isBox = item.type === 'box' || item.name.toLowerCase().includes('caja');
    const icon = isBox ? '📦' : '🔹';

    return (
        <div className={styles.boxCard} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `4px solid ${programColors[item.program] || '#ccc'}` }}>
            {/* Header Row: Icon + Name + Delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                <input
                    type="text"
                    value={item.name}
                    onChange={(e) => onUpdateName(e.target.value)}
                    className={styles.editableTitle}
                    style={{ flex: 1, border: 'none', borderBottom: '1px dashed transparent', padding: '2px 0', fontSize: '1rem', fontWeight: 500 }}
                    placeholder="Nombre del ítem..."
                />
                <button onClick={onDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.1rem' }}>
                    &times;
                </button>
            </div>

            {/* Controls Row: Quantity */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 4 }}>
                    {isBox ? (item.type === 'box' ? 'Caja Registrada' : 'Detectado como Caja') : 'Material Suelto'}
                </span>
                <div className={styles.qtyControl}>
                    <button onClick={() => onUpdateQty(Math.max(0, item.qty - 1))} className={styles.qtyBtn}>-</button>
                    <span style={{ width: 30, textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</span>
                    <button onClick={() => onUpdateQty(item.qty + 1)} className={styles.qtyBtn}>+</button>
                </div>
            </div>
        </div>
    );
};


const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ location, onUpdate, onClose, programColors, onAssistantAction }) => {

    const handleChange = (field: keyof Ubicacion, value: any) => {
        onUpdate({ ...location, [field]: value });
    };

    // --- SHELF LOGIC ---
    const isShelf = location.tipo === 'estanteria_modulo';
    const moduleCount = useMemo(() => isShelf ? Math.max(1, Math.round(location.width / 1.0)) : 0, [location.width, isShelf]);
    const [selectedModule, setSelectedModule] = useState(1);
    const [selectedLevel, setSelectedLevel] = useState(1);

    // --- DATA UNIFICATION HELPER ---
    // Converts Location Data -> UnifiedItems
    const getUnifiedItems = (): UnifiedItem[] => {
        const items: UnifiedItem[] = [];

        // 1. Boxes (Cajas)
        let boxes: Caja[] = [];
        if (isShelf) {
            const key = `M${selectedModule}-A${selectedLevel}`;
            const box = location.cajasEstanteria?.[key];
            if (box) boxes = [box];
        } else {
            boxes = location.cajas || [];
        }

        boxes.forEach(b => {
            // Use new 'cantidad' field if present, otherwise default to 1 (legacy)
            const validQty = (b.cantidad !== undefined) ? b.cantidad : 1;
            items.push({
                id: b.id,
                type: 'box',
                name: b.descripcion,
                qty: validQty,
                program: b.programa,
                originalRef: b
            });
        });

        // 2. Loose Items (Materiales)
        if (!isShelf && location.materiales) {
            location.materiales.forEach(m => {
                items.push({
                    id: m.id,
                    type: 'loose',
                    name: m.nombre,
                    qty: m.cantidad,
                    program: location.programa,
                    originalRef: m
                });
            });
        }

        return items;
    };

    const unifiedList = getUnifiedItems();

    // --- UPDATERS ---

    // Generic updater for an item (finds it in boxes or loose items and updates it)
    const handleUpdateItem = (itemId: string, updates: Partial<UnifiedItem>) => {
        let newBoxes = [...(location.cajas || [])];
        let newLoose = [...(location.materiales || [])];
        let shelfMap = { ...(location.cajasEstanteria || {}) };

        const isBox = newBoxes.find(b => b.id === itemId) || (isShelf && Object.values(shelfMap).find(b => b.id === itemId));

        if (isBox) {
            // Update Box
            if (isShelf) {
                const key = `M${selectedModule}-A${selectedLevel}`;
                if (shelfMap[key] && shelfMap[key].id === itemId) {
                    shelfMap[key] = {
                        ...shelfMap[key],
                        descripcion: updates.name !== undefined ? updates.name : shelfMap[key].descripcion,
                        cantidad: updates.qty !== undefined ? updates.qty : shelfMap[key].cantidad
                    };
                    handleChange('cajasEstanteria', shelfMap);
                }
            } else {
                newBoxes = newBoxes.map(b => b.id === itemId ? {
                    ...b,
                    descripcion: updates.name !== undefined ? updates.name : b.descripcion,
                    cantidad: updates.qty !== undefined ? updates.qty : b.cantidad
                } : b);
                handleChange('cajas', newBoxes);
            }
        } else {
            // Must be Loose Item
            newLoose = newLoose.map(m => m.id === itemId ? {
                ...m,
                nombre: updates.name !== undefined ? updates.name : m.nombre,
                cantidad: updates.qty !== undefined ? updates.qty : m.cantidad
            } : m);
            handleChange('materiales', newLoose);
        }
    };

    const handleDeleteItem = (itemId: string) => {
        if (!confirm("¿Eliminar este ítem?")) return;

        if (isShelf) {
            const key = `M${selectedModule}-A${selectedLevel}`;
            const shelfMap = { ...(location.cajasEstanteria || {}) };
            if (shelfMap[key]?.id === itemId) {
                delete shelfMap[key];
                handleChange('cajasEstanteria', shelfMap);
            }
        } else {
            // Try removing from Boxes
            const boxesFiltered = (location.cajas || []).filter(b => b.id !== itemId);
            if (boxesFiltered.length !== (location.cajas || []).length) {
                handleChange('cajas', boxesFiltered);
            } else {
                // Try removing from Loose
                const looseFiltered = (location.materiales || []).filter(m => m.id !== itemId);
                handleChange('materiales', looseFiltered);
            }
        }
    };

    const handleAddItem = (isBox: boolean) => {
        if (isShelf && unifiedList.length > 0) {
            alert("En estantería solo cabe 1 ítem por hueco (de momento).");
            return;
        }

        const baseProgram = location.programa || 'Vacio';
        const newId = crypto.randomUUID().slice(0, 6);

        if (isBox) {
            const newBox: Caja = {
                id: `BX-${newId}`,
                descripcion: "Nueva Caja",
                programa: baseProgram,
                cantidad: 1,
                contenido: []
            };
            if (isShelf) {
                const key = `M${selectedModule}-A${selectedLevel}`;
                handleChange('cajasEstanteria', { ...(location.cajasEstanteria || {}), [key]: newBox });
            } else {
                handleChange('cajas', [...(location.cajas || []), newBox]);
            }
        } else {
            // Loose Item
            const newItem: MaterialEnCaja = {
                id: `M-${newId}`,
                materialId: 'gen',
                nombre: "Nuevo Material Suelto",
                cantidad: 1,
                estado: 'operativo'
            };
            handleChange('materiales', [...(location.materiales || []), newItem]);
        }
    };

    return (
        <>
            <div className={styles.panelOverlay} onClick={onClose} />
            <div className={styles.panel}>
                {/* HEADER */}
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <span className={styles.palletId}>
                            {isShelf ? `Estantería #${location.id}` : `Palet #${location.id}`}
                        </span>
                        <span className={styles.palletDesc}>
                            {isShelf ? `Módulo ${selectedModule} • Nivel ${selectedLevel}` : (location.contenido || "Sin Descripción")}
                        </span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                {/* CONTENT */}
                <div className={styles.content}>

                    {/* SHELF NAV (UNCHANGED) */}
                    {isShelf && (
                        <div style={{ marginBottom: 20, paddingBottom: 15, borderBottom: '1px dashed #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8 }}>
                                {Array.from({ length: moduleCount }).map((_, i) => (
                                    <button key={i + 1} onClick={() => setSelectedModule(i + 1)}
                                        style={{ padding: '6px 10px', borderRadius: '4px', border: selectedModule === i + 1 ? '2px solid var(--color-primary)' : '1px solid #ddd', background: selectedModule === i + 1 ? '#e8f5e9' : '#fff', fontWeight: selectedModule === i + 1 ? 'bold' : 'normal', cursor: 'pointer' }}>
                                        M{i + 1}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {[1, 2, 3, 4].map(lvl => (
                                    <button key={lvl} onClick={() => setSelectedLevel(lvl)}
                                        style={{ flex: 1, padding: '6px', borderRadius: '4px', background: selectedLevel === lvl ? 'var(--color-primary)' : '#f1f5f9', color: selectedLevel === lvl ? '#fff' : '#475569', border: 'none', cursor: 'pointer' }}>
                                        Nv {lvl}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* UNIFIED LIST */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {unifiedList.length === 0 ? (
                            <div className={styles.emptyState}>
                                {isShelf ? `Hueco Vacío` : `Palet Vacío`}
                                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Añade una caja o material suelto.</div>
                            </div>
                        ) : (
                            unifiedList.map(item => (
                                <ItemCard
                                    key={item.id}
                                    item={item}
                                    programColors={programColors}
                                    onUpdateQty={(q) => handleUpdateItem(item.id, { qty: q })}
                                    onUpdateName={(n) => handleUpdateItem(item.id, { name: n })}
                                    onDelete={() => handleDeleteItem(item.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* FOOTER ACTIONS */}
                <div className={styles.footer}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <button className={styles.primaryAction} onClick={() => handleAddItem(true)} style={{ flex: 1 }}>+ Caja</button>
                        {!isShelf && (
                            <button className={styles.secondaryAction} onClick={() => handleAddItem(false)} style={{ flex: 1, backgroundColor: '#fffbe6', borderColor: '#ffe58f', color: '#d48806' }}>
                                + Suelto
                            </button>
                        )}
                    </div>
                    {!isShelf && (
                        <button className={styles.secondaryAction} onClick={() => {
                            onAssistantAction({ type: 'MOVE_PALLET', payload: { sourceId: location.id, contentName: location.contenido } });
                        }}>
                            🚚 Mover Palet
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

export default PropertiesPanel;
