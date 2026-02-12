import React, { useState, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import type { Ubicacion, Caja, MaterialEnCaja } from './types';
import { getLotAttributes } from './utils/lotVisualizer';
import styles from './components/UI/PropertiesPanel.module.css';
import { AddInventoryModal } from './components/UI/AddInventoryModal';

interface PropertiesPanelProps {
    location: Ubicacion;
    onUpdate: (u: Ubicacion) => void;
    onClose: () => void;
    programColors: Record<string, string>;
    onAssistantAction: (action: { type: string, payload: any }) => void;
    onPrint?: (loc: Ubicacion) => void;
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
    readOnly?: boolean;
}> = ({ item, onUpdateQty, onUpdateName, onDelete, programColors, readOnly }) => {

    // Auto-detect icon based on type or name
    const isBox = item.type === 'box' || item.name.toLowerCase().includes('caja');
    const icon = isBox ? '📦' : '🔹';

    // Contract 2: Resolve colors using shared logic
    const stripePrograms = getLotAttributes(item.originalRef);
    const stripeColors = stripePrograms.map(p => programColors[p] || '#ccc');

    return (
        <div className={styles.boxCard} style={{ display: 'flex', flexDirection: 'row', padding: 0, overflow: 'hidden', borderLeft: 'none' }}>
            {/* STRIPES CONTAINER (Left Edge) */}
            <div style={{ width: 8, minWidth: 8, display: 'flex', flexDirection: 'row', alignSelf: 'stretch' }}>
                {stripeColors.map((color, idx) => (
                    <div key={idx} style={{ flex: 1, backgroundColor: color }} />
                ))}
            </div>

            {/* CONTENT CONTAINER */}
            <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Header Row: Icon + Name + Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                    {readOnly ? (
                        <span style={{ flex: 1, fontSize: '1rem', fontWeight: 500, padding: '2px 0' }}>{item.name}</span>
                    ) : (
                        <input
                            type="text"
                            value={item.name}
                            onChange={(e) => onUpdateName(e.target.value)}
                            className={styles.editableTitle}
                            style={{ flex: 1, border: 'none', borderBottom: '1px dashed transparent', padding: '2px 0', fontSize: '1rem', fontWeight: 500 }}
                            placeholder="Nombre del ítem..."
                        />
                    )}
                    {!readOnly && (
                        <button onClick={onDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.1rem' }}>
                            &times;
                        </button>
                    )}
                </div>

                {/* Controls Row: Quantity */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {isBox ? (item.type === 'box' ? 'Caja Registrada' : 'Detectado como Caja') : 'Material Suelto'}
                    </span>
                    <div className={styles.qtyControl}>
                        {!readOnly && <button onClick={() => onUpdateQty(Math.max(0, item.qty - 1))} className={styles.qtyBtn}>-</button>}
                        <span style={{ width: 30, textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</span>
                        {!readOnly && <button onClick={() => onUpdateQty(item.qty + 1)} className={styles.qtyBtn}>+</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};


const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ location, onUpdate, onClose, programColors, onAssistantAction, onPrint }) => {

    const { user } = useAuth();
    const isVisitor = user?.role === 'VISITOR';

    const handleChange = (field: keyof Ubicacion, value: any) => {
        onUpdate({ ...location, [field]: value });
    };

    // --- SHELF LOGIC ---
    const isShelf = location.tipo === 'estanteria_modulo';
    const moduleCount = useMemo(() => isShelf ? Math.max(1, Math.round(location.width / 1.0)) : 0, [location.width, isShelf]);
    const [selectedModule, setSelectedModule] = useState(1);
    const [selectedLevel, setSelectedLevel] = useState(1);
    const [showAddModal, setShowAddModal] = useState(false);

    // --- DATA UNIFICATION HELPER ---
    // Converts Location Data -> UnifiedItems
    const getUnifiedItems = (): UnifiedItem[] => {
        const items: UnifiedItem[] = [];

        // 1. Boxes (Cajas)
        let boxes: Caja[] = [];
        if (isShelf) {
            const key = `M${selectedModule}-A${selectedLevel}`;
            if (location.shelfItems?.[key]) {
                boxes = location.shelfItems[key];
            } else if (location.niveles) {
                const levelIdx = selectedLevel - 1;
                if (location.niveles[levelIdx]?.items) {
                    boxes = location.niveles[levelIdx].items;
                }
            } else {
                const box = location.cajasEstanteria?.[key];
                if (box) boxes = [box];
            }
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
    const handleUpdateItem = (itemId: string, updates: Partial<UnifiedItem>) => {
        let newBoxes = [...(location.cajas || [])];
        let newLoose = [...(location.materiales || [])];
        let shelfMap = { ...(location.cajasEstanteria || {}) };

        const isBox = newBoxes.find(b => b.id === itemId) || (isShelf && Object.values(shelfMap).find(b => b.id === itemId));

        if (isBox) {
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
            const boxesFiltered = (location.cajas || []).filter(b => b.id !== itemId);
            if (boxesFiltered.length !== (location.cajas || []).length) {
                handleChange('cajas', boxesFiltered);
            } else {
                const looseFiltered = (location.materiales || []).filter(m => m.id !== itemId);
                handleChange('materiales', looseFiltered);
            }
        }
    };

    const handleAddInventory = (data: { program: string; name: string; quantity: number; type: 'CAJA' | 'MATERIAL' }) => {
        // Construct payload for "ENTRADA" action
        const targetId = isShelf ? `E${location.id.replace('E', '')}-M${selectedModule}-A${selectedLevel}` : location.id;

        onAssistantAction({
            type: 'MANUAL_ENTRY',
            payload: {
                item: data.name,
                qty: data.quantity,
                origin: "EXTERIOR",
                destination: targetId,
                type: "ENTRADA",
                reason: `UI: ${data.program}`,
                program: data.program,
                item_type: data.type // 'CAJA' or 'MATERIAL'
            }
        });
    };

    return (
        <>
            <div className={styles.panelOverlay} onClick={onClose} />
            <div className={styles.panel}>
                {/* HEADER */}
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <span className={styles.palletId}>
                            {isShelf ? `Estantería #${location.id}` :
                                location.tipo === 'zona_carga' ? `Zona de Carga` :
                                    `Palet #${location.id}`}
                        </span>
                        <span className={styles.palletDesc}>
                            {isShelf ? `Módulo ${selectedModule} • Nivel ${selectedLevel}` : (location.contenido || "Sin Descripción")}
                        </span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                {/* CONTENT */}
                <div className={styles.content}>

                    {/* SHELF NAV */}
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
                                {isShelf ? `Hueco Vacío` :
                                    location.tipo === 'zona_carga' ? 'Zona de Carga Vacía' :
                                        `Palet Vacío`}
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
                                    readOnly={isVisitor}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* FOOTER ACTIONS */}
                {!isVisitor && (
                    <div className={styles.footer}>
                        <button
                            className={styles.primaryAction}
                            onClick={() => setShowAddModal(true)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            <span>+</span> Añadir Stock
                        </button>

                        {!isShelf && (
                            <button className={styles.secondaryAction} onClick={() => {
                                onAssistantAction({ type: 'MOVE_PALLET', payload: { sourceId: location.id, contentName: location.contenido } });
                            }}>
                                🚚 Mover Palet
                            </button>
                        )}
                        {onPrint && (
                            <button className={styles.secondaryAction} onClick={() => onPrint(location)} title="Imprimir Ficha">
                                🖨️
                            </button>
                        )}
                    </div>
                )}

                {/* ADD INVENTORY MODAL */}
                <AddInventoryModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSave={handleAddInventory}
                    programColors={programColors}
                />
            </div>
        </>
    );
};

export default PropertiesPanel;
