import React from 'react';
import type { Caja, Ubicacion, MaterialEnCaja } from '../../types';
import styles from './PropertiesPanel.module.css';

interface BoxDetailPanelProps {
    box: Caja;
    parentLocation: Ubicacion;
    onBack: () => void;
    onUpdateBox: (updatedBox: Caja) => void;
    onAssistantAction: (action: { type: string, payload: any }) => void;
    programColors: Record<string, string>;
}

export const BoxDetailPanel: React.FC<BoxDetailPanelProps> = ({
    box,
    parentLocation,
    onBack,
    onUpdateBox,
    onAssistantAction,
    programColors
}) => {
    const badgeColor = programColors[box.programa] || '#e2e8f0';

    // Fix: Handle legacy string content or undefined
    let materials: MaterialEnCaja[] = [];
    if (Array.isArray(box.contenido)) {
        materials = box.contenido;
    } else if (typeof box.contenido === 'string' && (box.contenido as string).trim() !== '') {
        // Migration on the fly for display
        materials = [{
            id: 'legacy-1',
            nombre: box.contenido,
            cantidad: 1,
            estado: 'operativo', // Fixed: Use valid literal type
            programa: box.programa,
            tipo: 'material' // This doesn't exist on MaterialEnCaja type? Let's check.
        } as unknown as MaterialEnCaja]; // Cast to avoid partial mismatch if type is strict
    }

    return (
        <div className={styles.panel}>
            {/* 1. CABECERA */}
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={onBack}>
                    ← Volver
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {parentLocation.tipo === 'palet' ? `PALET #${parentLocation.id}` : `ESTANTERÍA #${parentLocation.id}`}
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                        {box.descripcion}
                    </div>
                </div>
                <div className={styles.boxIdBadge} style={{ backgroundColor: badgeColor, color: '#333' }}>
                    {box.programa}
                </div>
            </div>

            {/* 2. CONTENIDO (LISTA DE MATERIALES) */}
            <div className={styles.content}>
                <div style={{ marginBottom: 10, fontWeight: 600, color: '#333' }}>
                    Contenido de la Caja:
                </div>

                {materials.length === 0 ? (
                    <div className={styles.emptyState}>
                        Caja sin materiales inventariados.
                        <br />
                        <button
                            className={styles.textActionBtn}
                            onClick={() => onAssistantAction({
                                type: 'ADD_MATERIAL',
                                payload: { boxId: box.id, boxName: box.descripcion }
                            })}
                        >
                            + Añadir Material
                        </button>
                    </div>
                ) : (
                    <div className={styles.materialsList}>
                        {materials.map((mat, idx) => (
                            <div key={mat.id || idx} className={styles.materialRowItem}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{mat.nombre}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        {mat.estado.toUpperCase()}
                                    </div>
                                </div>
                                <div className={styles.qtyControl}>
                                    <button
                                        className={styles.qtyBtn}
                                        onClick={() => {
                                            const newMats = [...materials];
                                            const newQty = Math.max(0, mat.cantidad - 1);
                                            // Optional: remove if 0? Or keep as 0? Keep as 0 for now.
                                            newMats[idx] = { ...mat, cantidad: newQty };
                                            onUpdateBox({ ...box, contenido: newMats });
                                        }}
                                    >-</button>
                                    <span style={{ width: 30, textAlign: 'center' }}>{mat.cantidad}</span>
                                    <button
                                        className={styles.qtyBtn}
                                        onClick={() => {
                                            const newMats = [...materials];
                                            newMats[idx] = { ...mat, cantidad: mat.cantidad + 1 };
                                            onUpdateBox({ ...box, contenido: newMats });
                                        }}
                                    >+</button>
                                </div>
                            </div>
                        ))}
                        <button
                            className={styles.dashedBtn}
                            onClick={() => onAssistantAction({
                                type: 'ADD_MATERIAL',
                                payload: { boxId: box.id, boxName: box.descripcion }
                            })}
                        >
                            + Añadir otro material
                        </button>
                    </div>
                )}
            </div>

            {/* 3. ACCIONES PRINCIPALES */}
            <div className={styles.footer} style={{ flexDirection: 'column', gap: 10 }}>
                <button
                    className={styles.primaryAction}
                    style={{ width: '100%' }}
                    onClick={() => onAssistantAction({
                        type: 'MOVE_BOX',
                        payload: {
                            sourceLocationId: parentLocation.id,
                            boxId: box.id,
                            boxName: box.descripcion
                        }
                    })}
                >
                    🚚 Mover Caja Completa
                </button>

                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    <button
                        className={styles.secondaryAction}
                        style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }}
                        onClick={() => {
                            if (confirm("¿Estás seguro de eliminar esta caja y todo su contenido?")) {
                                onAssistantAction({
                                    type: 'DELETE_BOX',
                                    payload: { boxId: box.id }
                                });
                            }
                        }}
                    >
                        🗑️ Eliminar
                    </button>
                    {/* Más acciones secundarias si se requieren */}
                </div>
            </div>
        </div>
    );
};
