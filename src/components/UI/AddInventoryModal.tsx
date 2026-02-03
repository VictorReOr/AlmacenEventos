import React, { useState } from 'react';

interface AddInventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { program: string; name: string; quantity: number; type: 'CAJA' | 'MATERIAL' }) => void;
    programColors: Record<string, string>;
}

export const AddInventoryModal: React.FC<AddInventoryModalProps> = ({ isOpen, onClose, onSave, programColors }) => {
    const [program, setProgram] = useState('Mentor 10');
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [type, setType] = useState<'CAJA' | 'MATERIAL'>('CAJA');

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({ program, name, quantity, type });
        // Reset and close
        setName('');
        setQuantity(1);
        setType('CAJA');
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem', color: '#1a1a1a' }}>📥 Añadir Existencias</h3>

                {/* Type Selector */}
                <div style={{ marginBottom: '20px', display: 'flex', backgroundColor: '#f0f2f5', padding: 4, borderRadius: 8 }}>
                    <button
                        onClick={() => setType('CAJA')}
                        style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: 6,
                            border: 'none',
                            background: type === 'CAJA' ? 'white' : 'transparent',
                            color: type === 'CAJA' ? '#2563eb' : '#666',
                            boxShadow: type === 'CAJA' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            fontWeight: type === 'CAJA' ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        📦 Caja
                    </button>
                    <button
                        onClick={() => setType('MATERIAL')}
                        style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: 6,
                            border: 'none',
                            background: type === 'MATERIAL' ? 'white' : 'transparent',
                            color: type === 'MATERIAL' ? '#d97706' : '#666',
                            boxShadow: type === 'MATERIAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            fontWeight: type === 'MATERIAL' ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        🔹 Material Suelto
                    </button>
                </div>

                {/* Program Selector */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>Programa:</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {Object.entries(programColors)
                            .filter(([p]) => !['Vacio'].includes(p))
                            .map(([p, color]) => (
                                <button
                                    key={p}
                                    onClick={() => setProgram(p)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        border: `1px solid ${program === p ? color : '#eee'}`,
                                        borderRadius: '20px',
                                        backgroundColor: program === p ? `${color}22` : 'transparent',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }}></div>
                                    {p}
                                </button>
                            ))}
                    </div>
                </div>

                {/* Name Input */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>Descripción:</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Gymsack de Andalucía"
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            fontSize: '1rem'
                        }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
                        {type === 'CAJA' ? 'Se registrará como una caja cerrada.' : 'Se registrará como unidades sueltas.'}
                    </div>
                </div>

                {/* Quantity Input */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>Cantidad:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}
                        >-</button>
                        <span style={{ fontSize: '1.2rem', fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>{quantity}</span>
                        <button
                            onClick={() => setQuantity(quantity + 1)}
                            style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}
                        >+</button>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#f5f5f5',
                            color: '#666',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#2563eb',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 500,
                            opacity: !name.trim() ? 0.5 : 1
                        }}
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};
