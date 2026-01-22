import React, { useState, useMemo } from 'react';
import type { Ubicacion, Caja, MaterialEnCaja } from './types';
import styles from './components/UI/PropertiesPanel.module.css';
import { BoxDetailPanel } from './components/UI/BoxDetailPanel';



interface PropertiesPanelProps {
    location: Ubicacion;
    onUpdate: (u: Ubicacion) => void;
    onClose: () => void;
    programColors: Record<string, string>;
    onAssistantAction: (action: { type: string, payload: any }) => void;
}

// --- SUB-COMPONENT: BOX CARD ---
const BoxCard: React.FC<{
    box: Caja;
    onDelete: () => void;
    programColors: Record<string, string>;
    onViewDetail: () => void;
}> = ({ box, onDelete, programColors, onViewDetail }) => {

    const badgeColor = programColors[box.programa] || '#e2e8f0';
    const totalItems = box.contenido.reduce((acc, m) => acc + m.cantidad, 0);

    return (
        <div className={styles.boxCard} onClick={onViewDetail} style={{ cursor: 'pointer' }}>
            <div className={styles.cardHeader}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className={styles.boxIdBadge} style={{ backgroundColor: badgeColor, color: '#333' }}>
                        📦 CAJA
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '1rem', marginTop: 4 }}>
                        {box.descripcion}
                    </span>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                    {box.id}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        style={{ marginLeft: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                        title="Eliminar Caja"
                    >
                        &times;
                    </button>
                </div>
            </div>

            <div className={styles.cardBody}>
                <div className={styles.materialRow}>
                    <span className={styles.materialName}>Materiales</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{totalItems}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Clic para ver contenido
                </div>
            </div>
        </div>
    );
};


// --- SUB-COMPONENT: LOOSE ITEM CARD ---
const LooseItemCard: React.FC<{
    item: MaterialEnCaja;
    onUpdate: (newItem: MaterialEnCaja) => void;
    onDelete: () => void;
}> = ({ item, onUpdate, onDelete }) => {
    return (
        <div className={styles.boxCard} style={{ borderColor: '#FFB74D', backgroundColor: '#FFF8E1' }}>
            <div className={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔹</span>
                    <input
                        value={item.nombre}
                        onChange={(e) => onUpdate({ ...item, nombre: e.target.value })}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            fontWeight: 600,
                            fontSize: '1rem',
                            flex: 1,
                            borderBottom: '1px dashed #ccc'
                        }}
                    />
                </div>
                <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#E57373', cursor: 'pointer', fontSize: '1.2rem' }}>
                    &times;
                </button>
            </div>

            <div className={styles.cardBody} style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Cantidad ({item.estado})</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => onUpdate({ ...item, cantidad: Math.max(0, item.cantidad - 1) })}
                            style={{ width: 24, height: 24, borderRadius: 12, border: '1px solid #ccc', cursor: 'pointer', background: '#fff' }}
                        >-</button>
                        <span style={{ fontWeight: 'bold' }}>{item.cantidad}</span>
                        <button
                            onClick={() => onUpdate({ ...item, cantidad: item.cantidad + 1 })}
                            style={{ width: 24, height: 24, borderRadius: 12, border: '1px solid #ccc', cursor: 'pointer', background: '#fff' }}
                        >+</button>
                    </div>
                </div>
            </div>
        </div>
    );
};



const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ location, onUpdate, onClose, programColors, onAssistantAction }) => {

    // --- VIEW STATE ---
    const [viewedBoxId, setViewedBoxId] = useState<string | null>(null);

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

    // --- ACCESS HELPERS ---

    // Get Boxes list based on context
    const getBoxes = (): Caja[] => {
        if (isShelf) {
            // In Shelf, we look for key "MX-AX"
            const key = `M${selectedModule}-A${selectedLevel}`;
            const box = location.cajasEstanteria?.[key];
            return box ? [box] : [];
        } else {
            // In Pallet, simple list
            return location.cajas || [];
        }
    };

    const currentBoxes = getBoxes();



    // Helper to update boxes list
    const updateBoxes = (newBoxes: Caja[]) => {
        if (isShelf) {
            const key = `M${selectedModule}-A${selectedLevel}`;
            const newMap = { ...(location.cajasEstanteria || {}) };
            if (newBoxes.length > 0) {
                newMap[key] = newBoxes[0]; // Rule: Only 1 box per slot
            } else {
                delete newMap[key];
            }
            handleChange('cajasEstanteria', newMap);
        } else {
            handleChange('cajas', newBoxes);
        }
    };

    // --- LOOSE ITEMS HELPERS (Pallet Only for now) ---
    const looseItems = location.materiales || [];

    const updateLooseItems = (newItems: MaterialEnCaja[]) => {
        handleChange('materiales', newItems);
    };

    const handleAddLooseItem = () => {
        const newItem: MaterialEnCaja = {
            id: `M-${crypto.randomUUID().slice(0, 4)}`,
            materialId: 'gen-mat',
            nombre: 'Nuevo Material',
            cantidad: 1,
            estado: 'operativo'
        };
        updateLooseItems([...looseItems, newItem]);
    };


    // Get currently viewed box object
    const viewedBox = viewedBoxId
        ? (isShelf
            ? Object.values(location.cajasEstanteria || {}).find(b => b.id === viewedBoxId)
            : location.cajas?.find(b => b.id === viewedBoxId))
        : null;


    // Add Item Logic
    const handleAddBox = () => {
        if (isShelf && currentBoxes.length > 0) {
            alert("❌ Regla: Una posición de estantería solo puede tener 1 caja.");
            return;
        }

        const newBox: Caja = {
            id: `C-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
            descripcion: isShelf ? 'Nueva Caja Estantería' : 'Nueva Caja',
            programa: location.programa || 'Vacio',
            contenido: []
        };

        if (isShelf) {
            // Replace/Set
            updateBoxes([newBox]);
        } else {
            // Append
            updateBoxes([...currentBoxes, newBox]);
        }
    };

    // --- RENDER DETAIL VIEW IF ACTIVE ---
    if (viewedBox) {
        return (
            <>
                <div className={styles.panelOverlay} onClick={onClose} />
                <BoxDetailPanel
                    box={viewedBox}
                    parentLocation={location}
                    onBack={() => setViewedBoxId(null)}
                    programColors={programColors}
                    onAssistantAction={onAssistantAction}
                    onUpdateBox={(updatedBox) => {
                        // Update logic
                        if (isShelf) {
                            const key = Object.keys(location.cajasEstanteria || {}).find(k => location.cajasEstanteria![k].id === updatedBox.id);
                            if (key) {
                                const newMap = { ...location.cajasEstanteria };
                                newMap[key] = updatedBox;
                                handleChange('cajasEstanteria', newMap);
                            }
                        } else {
                            const newBoxes = (location.cajas || []).map(b => b.id === updatedBox.id ? updatedBox : b);
                            handleChange('cajas', newBoxes);
                        }
                    }}
                />
            </>
        )
    }

    // --- RENDER MAIN LIST VIEW ---
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
                            {isShelf ? `Módulo ${selectedModule} • Nivel ${selectedLevel}` : (location.contenido || "Desc. Palet")}
                        </span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                {/* CONTENT */}
                <div className={styles.content}>

                    {/* SHELF NAVIGATOR */}
                    {isShelf && (
                        <div style={{ marginBottom: 20, paddingBottom: 15, borderBottom: '1px dashed #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8 }}>
                                {Array.from({ length: moduleCount }).map((_, i) => {
                                    const m = i + 1;
                                    const isSel = selectedModule === m;
                                    return (
                                        <button
                                            key={m}
                                            onClick={() => setSelectedModule(m)}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '4px',
                                                border: isSel ? '2px solid var(--color-primary)' : '1px solid #ddd',
                                                background: isSel ? '#e8f5e9' : '#fff',
                                                fontWeight: isSel ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem'
                                            }}
                                        >
                                            M{m}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {[1, 2, 3, 4].map(lvl => {
                                    const isSel = selectedLevel === lvl;
                                    return (
                                        <button
                                            key={lvl}
                                            onClick={() => setSelectedLevel(lvl)}
                                            style={{
                                                flex: 1,
                                                padding: '6px',
                                                borderRadius: '4px',
                                                background: isSel ? 'var(--color-primary)' : '#f1f5f9',
                                                color: isSel ? '#fff' : '#475569',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                fontWeight: 500
                                            }}
                                        >
                                            Nv {lvl}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* BOXES LIST */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {currentBoxes.length === 0 ? (
                            <div className={styles.emptyState}>
                                {isShelf ? `Hueco Vacío (M${selectedModule}-N${selectedLevel})` : `📦 Palet sin cajas`}
                                <br />
                                <span style={{ fontSize: '0.85rem' }}>Usa "+ Añadir Caja" para registrar entrada.</span>
                            </div>
                        ) : (
                            currentBoxes.map(box => (
                                <BoxCard
                                    key={box.id}
                                    box={box}
                                    programColors={programColors}
                                    onDelete={() => {
                                        if (window.confirm("¿Retirar esta caja?")) {
                                            if (isShelf) {
                                                updateBoxes([]);
                                            } else {
                                                updateBoxes(currentBoxes.filter(b => b.id !== box.id));
                                            }
                                        }
                                    }}
                                    onViewDetail={() => setViewedBoxId(box.id)}
                                />
                            ))
                        )}
                    </div>

                    {/* SEPARATOR IF BOTH EXIST */}
                    {currentBoxes.length > 0 && looseItems.length > 0 && (
                        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                    )}

                    {/* LOOSE ITEMS LIST (Only for Pallets currently) */}
                    {!isShelf && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {looseItems.length > 0 && (
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                    Material Suelto
                                </div>
                            )}
                            {looseItems.map(item => (
                                <LooseItemCard
                                    key={item.id}
                                    item={item}
                                    onUpdate={(newItem) => {
                                        updateLooseItems(looseItems.map(i => i.id === newItem.id ? newItem : i));
                                    }}
                                    onDelete={() => {
                                        if (window.confirm("¿Eliminar este material suelto?")) {
                                            updateLooseItems(looseItems.filter(i => i.id !== item.id));
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER ACTIONS */}
                <div className={styles.footer}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <button className={styles.primaryAction} onClick={handleAddBox} style={{ flex: 1 }}>
                            + Caja
                        </button>
                        {!isShelf && (
                            <button className={styles.secondaryAction} onClick={handleAddLooseItem} style={{ flex: 1, backgroundColor: '#FFF8E1', color: '#F57C00', borderColor: '#FFE0B2' }}>
                                + Material
                            </button>
                        )}
                    </div>

                    {!isShelf && (
                        <button className={styles.secondaryAction} onClick={() => {
                            onAssistantAction({
                                type: 'MOVE_PALLET',
                                payload: {
                                    sourceId: location.id,
                                    contentName: location.contenido
                                }
                            });
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
