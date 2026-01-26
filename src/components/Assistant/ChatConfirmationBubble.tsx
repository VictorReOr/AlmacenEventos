import React from 'react';
import type { AssistantResponse } from '../../services/AssistantService';

interface ChatConfirmationBubbleProps {
    data: AssistantResponse;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ChatConfirmationBubble: React.FC<ChatConfirmationBubbleProps> = ({ data, onConfirm, onCancel }) => {

    // Helper to get Icon based on Intent
    const getIntentIcon = (intent: string) => {
        switch (intent) {
            case 'MOVE': return '🚚';
            case 'ADD': return '📥';
            case 'GIFT': return '🎁';
            case 'SEARCH': return '🔍';
            default: return '🤖';
        }
    };

    const getIntentLabel = (intent: string) => {
        switch (intent) {
            case 'MOVE': return 'Mover / Traslado';
            case 'ADD': return 'Nueva Entrada';
            case 'GIFT': return 'Salida (Regalo)';
            case 'SEARCH': return 'Búsqueda';
            default: return 'Desconocido';
        }
    };

    return (
        <div style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                <span style={{ fontSize: '1.2em' }}>{getIntentIcon(data.intent)}</span>
                <strong style={{ color: '#333' }}>{getIntentLabel(data.intent)}</strong>
            </div>

            <div style={{ fontSize: '0.9em', color: '#555', marginBottom: '10px' }}>
                {data.entities.length > 0 ? (
                    <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>
                        {data.entities.map((ent, idx) => (
                            <li key={idx}>
                                <strong>{ent.label}:</strong> {ent.text}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div style={{ fontStyle: 'italic', color: '#888' }}>
                        No he detectado detalles específicos.
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                    onClick={onConfirm}
                    style={{
                        flex: 1,
                        background: '#009688',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    ✅ Confirmar
                </button>
                <button
                    onClick={onCancel}
                    style={{
                        flex: 1,
                        background: '#f5f5f5',
                        color: '#666',
                        border: '1px solid #ddd',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    ❌ Cancelar
                </button>
            </div>
        </div>
    );
};
