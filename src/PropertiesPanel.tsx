import React, { useState, useMemo } from 'react';
import type { Ubicacion, Programa } from './types';

interface PropertiesPanelProps {
    location: Ubicacion;
    onUpdate: (u: Ubicacion) => void;
    onClose: () => void;
    programColors: Record<string, string>;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ location, onUpdate, onClose, programColors }) => {

    const handleChange = (field: keyof Ubicacion, value: any) => {
        onUpdate({ ...location, [field]: value });
    };

    // --- SHELF LOGIC ---
    const isShelf = location.tipo === 'estanteria_modulo';

    // Calculate Modules based on Width (approx 1m per module)
    const moduleCount = useMemo(() => {
        if (!isShelf) return 0;
        return Math.max(1, Math.round(location.width / 1.0));
    }, [location.width, isShelf]);

    const [selectedModule, setSelectedModule] = useState(1);
    const [selectedLevel, setSelectedLevel] = useState(1);

    const handleShelfContentChange = (val: string) => {
        const key = `M${selectedModule}-A${selectedLevel}`;
        const newContents = { ...(location.shelfContents || {}) };
        newContents[key] = val;
        handleChange('shelfContents', newContents);
    };

    const currentShelfContent = location.shelfContents?.[`M${selectedModule}-A${selectedLevel}`] || "";


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

                {/* --- PALET: CONTENT EDITOR --- */}
                {!isShelf && (
                    <>
                        <div className="prop-group">
                            <label>Programa / Cliente</label>
                            <select
                                value={location.programa}
                                onChange={(e) => handleChange('programa', e.target.value as Programa)}
                                style={{
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontWeight: 'bold',
                                    color: programColors[location.programa] || '#333'
                                }}
                            >
                                {Object.keys(programColors).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div className="prop-group">
                            <label>Contenido / Carga</label>
                            <textarea
                                rows={4}
                                value={location.contenido || ''}
                                onChange={(e) => handleChange('contenido', e.target.value)}
                                placeholder="Descripción de la carga..."
                                style={{ fontSize: '1rem' }}
                            />
                        </div>
                    </>
                )}

                {/* --- SHELF: MATRIX EDITOR --- */}
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

                        {/* 2. LEVEL SELECTOR (Visual Stack) */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ fontSize: '0.85rem', color: '#666' }}>2. Selecciona Altura</label>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column-reverse', // Level 1 at bottom
                                gap: 4,
                                background: '#f5f5f5',
                                padding: 8,
                                borderRadius: 6
                            }}>
                                {[1, 2, 3, 4].map(lvl => {
                                    const isSel = selectedLevel === lvl;
                                    const hasContent = !!location.shelfContents?.[`M${selectedModule}-A${lvl}`];

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
                                                alignItems: 'center',
                                                transition: 'all 0.1s'
                                            }}
                                        >
                                            <span style={{ fontWeight: 'bold' }}>Nivel {lvl}</span>
                                            {hasContent && !isSel && <span style={{ fontSize: '0.75rem' }}>📦</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. CONTENT EDITOR */}
                        <div className="prop-group">
                            <label style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                Contenido: {location.id} - M{selectedModule} - A{selectedLevel}
                            </label>
                            <textarea
                                rows={3}
                                value={currentShelfContent}
                                onChange={(e) => handleShelfContentChange(e.target.value)}
                                placeholder="Escribe el material aquí..."
                                style={{
                                    fontSize: '1.1rem',
                                    padding: 10,
                                    border: '2px solid var(--color-primary)',
                                    borderRadius: 6
                                }}
                                autoFocus
                            />
                        </div>
                    </div>
                )}


                {/* --- ADVANCED (Rotation, etc) --- */}
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
