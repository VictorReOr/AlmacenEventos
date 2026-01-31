import React, { useState } from 'react';
import styles from './ConfigModal.module.css';

interface ConfigModalProps {
    initialColors: Record<string, string>;
    scriptUrl: string;
    onSave: (newColors: Record<string, string>, newScriptUrl: string) => void;
    onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ initialColors, scriptUrl, onSave, onClose }) => {
    const [colors, setColors] = useState<Record<string, string>>({ ...initialColors });
    const [url, setUrl] = useState(scriptUrl);

    const [newProgName, setNewProgName] = useState('');
    const [newProgColor, setNewProgColor] = useState('#123456');

    const handleAddProgram = () => {
        if (!newProgName) return;
        if (colors[newProgName]) {
            alert('Este programa ya existe.');
            return;
        }
        setColors(prev => ({ ...prev, [newProgName]: newProgColor }));
        setNewProgName('');
        setNewProgColor('#' + Math.floor(Math.random() * 16777215).toString(16));
    };

    const handleDeleteProgram = (prog: string) => {
        if (prog === 'Vacio') {
            alert("No se puede borrar 'Vacio'");
            return;
        }
        if (confirm(`¿Borrar "${prog}"?`)) {
            const next = { ...colors };
            delete next[prog];
            setColors(next);
        }
    };

    return (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal} style={{ width: '500px', maxWidth: '90vw' }}>
                <h3 className={styles.header}>⚙️ Configuración</h3>

                {/* Script URL */}
                <div className={styles.section}>
                    <label className={styles.label}>URL Script Google Apps:</label>
                    <input
                        className={styles.input}
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/..."
                    />
                </div>

                {/* Colors Management */}
                <div className={styles.section}>
                    <label className={styles.label}>Programas y Colores:</label>

                    <div className={styles.programList}>
                        {Object.entries(colors).map(([prog, color]) => (
                            <div key={prog} className={styles.programItem}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div className={styles.colorPreview} style={{ backgroundColor: color }}>
                                        <input
                                            type="color"
                                            className={styles.colorInputHidden}
                                            value={color}
                                            onChange={(e) => setColors(prev => ({ ...prev, [prog]: e.target.value }))}
                                            title="Toca para cambiar color"
                                        />
                                    </div>
                                    <span className={styles.programName}>{prog}</span>
                                </div>
                                {prog !== 'Vacio' && (
                                    <button onClick={() => handleDeleteProgram(prog)} className={styles.deleteBtn} title="Borrar">
                                        🗑️
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add New */}
                    <div className={styles.addNew}>
                        <input
                            className={styles.input}
                            type="text"
                            placeholder="Nuevo Programa..."
                            value={newProgName}
                            onChange={e => setNewProgName(e.target.value)}
                        />
                        <div className={styles.colorPreview} style={{ backgroundColor: newProgColor, flexShrink: 0, width: 42, height: 42 }}>
                            <input
                                type="color"
                                className={styles.colorInputHidden}
                                value={newProgColor}
                                onChange={e => setNewProgColor(e.target.value)}
                            />
                        </div>
                        <button onClick={handleAddProgram} disabled={!newProgName} className={styles.addButton} title="Añadir">
                            +
                        </button>
                    </div>
                </div>

                {/* Emergency Reset Section */}
                <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid #eee' }}>
                    <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 10 }}>Zona de Peligro</p>
                    <button
                        onClick={() => {
                            if (confirm("⚠️ ¿Estás seguro? \n\nEsto BORRARÁ todo el mapa local y restaurará la configuración inicial. \n\nÚsalo solo si el mapa ha desaparecido o está corrupto.")) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }}
                        style={{
                            background: '#FFEBEE',
                            color: '#D32F2F',
                            border: '1px solid #FFCDD2',
                            padding: '8px 16px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            width: '100%',
                            fontWeight: 'bold'
                        }}
                    >
                        ⚠️ Restaurar Mapa de Fábrica (Reset)
                    </button>
                </div>

                <div className={styles.footer}>
                    <button className={`${styles.button} ${styles.cancelBtn}`} onClick={onClose}>Cancelar</button>
                    <button className={`${styles.button} ${styles.saveBtn}`} onClick={() => {
                        onSave(colors, url);
                        onClose();
                    }}>Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
};
