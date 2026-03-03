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
            case 'MOVE':
            case 'MOVIMIENTO': return '🚚';
            case 'ADD':
            case 'ENTRADA': return '📥';
            case 'GIFT':
            case 'SALIDA': return '📤';
            case 'SEARCH':
            case 'QUERY': return '🔍';
            default: return '🤖';
        }
    };

    const getIntentLabel = (intent: string) => {
        switch (intent) {
            case 'MOVE':
            case 'MOVIMIENTO': return 'Mover / Traslado';
            case 'ADD':
            case 'ENTRADA': return 'Nueva Entrada';
            case 'GIFT':
            case 'SALIDA': return 'Salida';
            case 'SEARCH':
            case 'QUERY': return 'Búsqueda';
            default: return 'Desconocido';
        }
    };

    const interpretation = data.interpretation;

    if (!interpretation) {
        return (
            <div style={{
                background: '#fee',
                border: '1px solid #fcc',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '8px',
                color: '#c33'
            }}>
                ⚠️ Error: {data.error || 'No se pudo procesar la solicitud'}
            </div>
        );
    }

    const isQuery = interpretation.intent === 'QUERY' || interpretation.intent === 'SEARCH';

    // Helper to render bold text from "**" markers
    const renderMessage = (text: string) => {
        if (!text) return null;
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) => {
            if (i % 2 === 1) return <strong key={i}>{part}</strong>;
            return <span key={i}>{part}</span>;
        });
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
                <span style={{ fontSize: '1.2em' }}>{getIntentIcon(interpretation.intent)}</span>
                <strong style={{ color: '#333' }}>{getIntentLabel(interpretation.intent)}</strong>
            </div>

            <div style={{ fontSize: '0.9em', color: '#555', marginBottom: '10px' }}>
                <p style={{ margin: '4px 0', fontStyle: 'italic', fontWeight: isQuery ? '500' : 'normal', color: isQuery ? '#000' : '#555', whiteSpace: 'pre-line' }}>
                    {renderMessage(interpretation.summary)}
                </p>

                {!isQuery && interpretation.movements.length > 0 && (
                    <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                        {interpretation.movements.map((mov, idx) => (
                            <li key={idx}>
                                <strong>{mov.item}</strong>: {mov.qty} unidades
                                <br />
                                <small style={{ color: '#666' }}>
                                    {mov.origin} → {mov.destination} ({mov.type})
                                </small>
                            </li>
                        ))}
                    </ul>
                )}

                {!isQuery && interpretation.movements.length === 0 && (
                    <div style={{ fontStyle: 'italic', color: '#888' }}>
                        No he detectado movimientos específicos.
                    </div>
                )}

                {data.warnings.length > 0 && (
                    <div style={{ marginTop: '8px', padding: '6px', background: '#fff3cd', borderRadius: '4px', fontSize: '0.85em' }}>
                        ⚠️ {data.warnings.join(', ')}
                    </div>
                )}
            </div>

            {!isQuery && (
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
            )}
        </div>
    );
};
