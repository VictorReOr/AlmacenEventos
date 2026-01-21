import React, { useState } from 'react';

interface ConfigModalProps {
    initialColors: Record<string, string>;
    scriptUrl: string; // Keep this existing config too
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
        // Randomize next color slightly?
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
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '450px', maxWidth: '90vw' }}>
                <h3>⚙️ Configuración</h3>

                {/* Script URL Section */}
                <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
                    <label>URL Script Google Apps:</label>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://script.google.com/..."
                    />
                </div>

                {/* Colors Management Section */}
                <div>
                    <label style={{ marginBottom: 10, display: 'block' }}>Programas y Colores:</label>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: 4, padding: 5, marginBottom: 10 }}>
                        {Object.entries(colors).map(([prog, color]) => (
                            <div key={prog} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColors(prev => ({ ...prev, [prog]: e.target.value }))}
                                        title="Cambiar Color"
                                        style={{ width: 30, height: 30, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontWeight: 500 }}>{prog}</span>
                                </div>
                                {prog !== 'Vacio' && (
                                    <button onClick={() => handleDeleteProgram(prog)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e57373' }} title="Borrar">
                                        🗑️
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add New */}
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 10, background: '#f9f9f9', padding: 8, borderRadius: 4 }}>
                        <input
                            type="text"
                            placeholder="Nuevo Programa..."
                            value={newProgName}
                            onChange={e => setNewProgName(e.target.value)}
                            style={{ flex: 1, margin: 0, fontSize: '0.9rem' }}
                        />
                        <input
                            type="color"
                            value={newProgColor}
                            onChange={e => setNewProgColor(e.target.value)}
                            style={{ width: 35, height: 35, padding: 0, margin: 0, border: 'none', background: 'none' }}
                        />
                        <button onClick={handleAddProgram} disabled={!newProgName} style={{ padding: '6px 12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                            +
                        </button>
                    </div>
                </div>

                <div className="modal-actions">
                    <button onClick={onClose}>Cancelar</button>
                    <button onClick={() => {
                        onSave(colors, url);
                        onClose();
                    }}>Guardar</button>
                </div>
            </div>
        </div>
    );
};
