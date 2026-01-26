import React, { useState } from 'react';
import styles from '../../ConfigModal.module.css'; // Reusing modal styles for consistency


interface PrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPrint: (options: PrintOptions) => void;
    programs: string[];
    hasSelection: boolean;
}

export interface PrintOptions {
    format: 'LIST' | 'MAP';
    scope: 'ALL' | 'SELECTION' | 'PROGRAM';
    programString?: string;
}

export const PrintModal: React.FC<PrintModalProps> = ({ isOpen, onClose, onPrint, programs, hasSelection }) => {
    const [format, setFormat] = useState<'LIST' | 'MAP'>('LIST');
    const [scope, setScope] = useState<'ALL' | 'SELECTION' | 'PROGRAM'>('ALL');
    const [selectedProgram, setSelectedProgram] = useState<string>(programs[0] || '');

    if (!isOpen) return null;

    const handlePrint = () => {
        onPrint({
            format,
            scope,
            programString: scope === 'PROGRAM' ? selectedProgram : undefined
        });
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className={styles.header}>
                    <h2>Imprimir Inventario</h2>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.content}>

                    {/* FORMAT SECTION */}
                    <div style={{ marginBottom: '20px' }}>
                        <h3 className={styles.sectionTitle}>1. Formato</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className={`${styles.actionButton} ${format === 'LIST' ? styles.primary : ''}`}
                                onClick={() => setFormat('LIST')}
                                style={{ flex: 1, opacity: format === 'LIST' ? 1 : 0.6 }}
                            >
                                📋 Listado
                            </button>
                            <button
                                className={`${styles.actionButton} ${format === 'MAP' ? styles.primary : ''}`}
                                onClick={() => setFormat('MAP')}
                                style={{ flex: 1, opacity: format === 'MAP' ? 1 : 0.6 }}
                            >
                                🗺️ Mapa Visual
                            </button>
                        </div>
                    </div>

                    {/* SCOPE SECTION */}
                    <div style={{ marginBottom: '20px' }}>
                        <h3 className={styles.sectionTitle}>2. Selección de Datos</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    checked={scope === 'ALL'}
                                    onChange={() => setScope('ALL')}
                                    className={styles.radio}
                                />
                                Imprimir Todo el Almacén
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: hasSelection ? 1 : 0.5 }}>
                                <input
                                    type="radio"
                                    checked={scope === 'SELECTION'}
                                    onChange={() => setScope('SELECTION')}
                                    disabled={!hasSelection}
                                    className={styles.radio}
                                />
                                Imprimir Solo Selección Actual {hasSelection ? '(Items seleccionados en el mapa)' : '(Selecciona items en el mapa primero)'}
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    checked={scope === 'PROGRAM'}
                                    onChange={() => setScope('PROGRAM')}
                                    className={styles.radio}
                                />
                                Filtrar por Programa:
                            </label>

                            {scope === 'PROGRAM' && (
                                <select
                                    value={selectedProgram}
                                    onChange={(e) => setSelectedProgram(e.target.value)}
                                    className={styles.input}
                                    style={{ marginLeft: '24px', width: 'calc(100% - 24px)' }}
                                >
                                    {programs.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className={styles.actions} style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
                        <button className={styles.cancelButton} onClick={onClose}>Cancelar</button>
                        <button className={`${styles.saveButton}`} onClick={handlePrint} style={{ marginLeft: '10px' }}>
                            🖨️ Imprimir
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
