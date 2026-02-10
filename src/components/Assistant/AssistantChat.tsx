import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Ubicacion } from '../../types';
import styles from './AssistantChat.module.css';
import { AssistantService } from '../../services/AssistantService';
import type { AssistantResponse } from '../../services/AssistantService';
import { ChatConfirmationBubble } from './ChatConfirmationBubble';
import { AssistantActionHandler } from '../../services/AssistantActionHandler';

interface AssistantChatProps {
    ubicaciones: Record<string, Ubicacion>;
    selectedId?: string;
    onSelectLocation: (id: string) => void;
    onUpdate: (u: Ubicacion | Ubicacion[]) => void;
    isOpen: boolean;
    onClose: () => void;
    initialAction?: { type: string, payload: any } | null;
    onClearAction?: () => void;
}

interface Message {
    id: string;
    text?: string;
    sender: 'bot' | 'user';
    structuredData?: AssistantResponse;
    isTyping?: boolean;
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
    ubicaciones,
    onUpdate,
    isOpen,
    onClose,
    initialAction,
    onClearAction
}) => {
    const { token } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Hola. Soy Almacenito. Puedo registrar movimientos o entradas. Escribe o sube una foto.',
            sender: 'bot'
        }
    ]);
    const [isThinking, setIsThinking] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [messages, isOpen]);

    // HANDLE INITIAL ACTION (Manual Entry from UI)
    useEffect(() => {
        const processInitialAction = async () => {
            if (isOpen && initialAction) {
                console.log("Processing Initial Action:", initialAction);
                setIsThinking(true);
                try {
                    // Directly submit specific actions
                    if (initialAction.type === 'MANUAL_ENTRY' || initialAction.type === 'MOVE_PALLET') {
                        // For MOVE_PALLET, we might want to just pre-fill text or ask question?
                        // But MANUAL_ENTRY is fully defined.

                        if (initialAction.type === 'MANUAL_ENTRY') {
                            const response = await AssistantService.submitAction(
                                initialAction.payload.type, // "ENTRADA"
                                initialAction.payload,
                                token || ''
                            );

                            if (response.status === 'SUCCESS') {
                                setMessages(prev => [...prev, {
                                    id: Date.now().toString(),
                                    text: `✅ Acción Registrada:\n${initialAction.payload.item} (x${initialAction.payload.qty}) en ${initialAction.payload.destination}`,
                                    sender: 'bot'
                                }]);

                                // --- OPTIMISTIC UPDATE ---
                                try {
                                    // Map payload to AssistantActionHandler entities
                                    const entities = [
                                        { label: 'DEST_LOC', text: initialAction.payload.destination },
                                        { label: 'ITEM', text: initialAction.payload.item },
                                        { label: 'QUANTITY', text: String(initialAction.payload.qty || 1) }
                                    ];

                                    // Map Action Type
                                    let intent = 'UNKNOWN';
                                    if (initialAction.payload.type === 'ENTRADA') intent = 'ADD';

                                    if (intent !== 'UNKNOWN') {
                                        const result = await AssistantActionHandler.executeAction(
                                            intent,
                                            entities,
                                            ubicaciones
                                        );
                                        if (result.updates.length > 0) {
                                            console.log("Optimistic update applying:", result.updates);
                                            onUpdate(result.updates);
                                        }
                                    }
                                } catch (optError) {
                                    console.warn("Optimistic update failed:", optError);
                                }

                            } else if (response.status === 'PENDING_APPROVAL') {
                                setMessages(prev => [...prev, {
                                    id: Date.now().toString(),
                                    text: `⏳ Solicitud enviada a aprobación (ID: ${response.transaction_id})`,
                                    sender: 'bot'
                                }]);
                            } else {
                                throw new Error(response.error || "Error desconocido");
                            }
                        }

                        if (initialAction.type === 'MOVE_PALLET') {
                            // Pre-fill text for user
                            setMessages(prev => [...prev, {
                                id: Date.now().toString(),
                                text: `🚚 Moviendo contenido de ${initialAction.payload.sourceId}. ¿A dónde lo llevamos?`,
                                sender: 'bot'
                            }]);
                            // We don't submit yet, we wait for destination.
                        }
                    }
                } catch (e: any) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        text: `❌ Error procesando acción: ${e.message}`,
                        sender: 'bot'
                    }]);
                } finally {
                    setIsThinking(false);
                    if (onClearAction) onClearAction();
                }
            }
        };
        processInitialAction();
    }, [isOpen, initialAction]); // Depend on isOpen to trigger when opened


    // --- HANDLERS ---

    const handleSend = async () => {
        if (!input.trim()) return;
        const text = input;
        setInput('');

        // Add User Message
        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }]);

        setIsThinking(true);
        try {
            // Call Backend
            const response = await AssistantService.parseText(text);

            // Add Bot Response (Structured)
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                sender: 'bot',
                structuredData: response
            }]);

        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "⚠️ Error de conexión con el cerebro (Backend).",
                sender: 'bot'
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Add User Message (File)
        setMessages(prev => [...prev, { id: Date.now().toString(), text: `📎 Archivo: ${file.name}`, sender: 'user' }]);
        setIsThinking(true);

        try {
            const ocrResult = await AssistantService.uploadFile(file);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: `👁️ OCR Completado:\n"${ocrResult.ocr_text}"\n\n¿Es correcto?`,
                sender: 'bot'
            }]);

            // Auto-fill input with OCR text to allow easy edit/send
            setInput(ocrResult.ocr_text.replace('[MOCK OCR] ', ''));

        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "⚠️ Error subiendo archivo.",
                sender: 'bot'
            }]);
        } finally {
            setIsThinking(false);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleConfirmAction = async (msgId: string) => {
        const msgIndex = messages.findIndex(m => m.id === msgId);
        if (msgIndex === -1) return;

        const data = messages[msgIndex].structuredData;
        if (!data || !data.interpretation || !data.token) return;

        setIsThinking(true);
        try {
            // Updated to call Backend
            const result = await AssistantService.confirmRequest(
                data.interpretation,
                data.token, // This is the action token from parse response
                token || '' // This is the User Auth token
            );

            // 1. Handle Response Status
            if (result.status === "PENDING_APPROVAL") {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    text: `⏳ Acción Enviada a Aprobación.\nID: ${result.transaction_id}\nUn administrador debe aprobarla.`,
                    sender: 'bot'
                }]);
            } else if (result.status === "SUCCESS") {
                // If success, we should refresh the map. 
                // Since backend is source of truth, we might need to reload state or apply local updates if we trust them.
                // For now, let's assume we need to reload or apply local logic.
                // Applying local logic for immediate feedback:

                try {
                    // We re-use logic from AssistantActionHandler just to get updates 
                    // BUT verify if backend returned updated balance? Backends usually don't return full map updates.
                    // Let's rely on AssistantActionHandler for the optimistic UI update
                    // Or Fetch latest map? Fetching latest map is safer.
                    // Triggering onUpdate with specific changes is key for React state.

                    // Optimistic update:
                    const legacyEntities = data.interpretation.movements.map(mov => ({
                        text: `${mov.item} ${mov.qty} ${mov.origin} ${mov.destination}`,
                        label: mov.type
                    }));

                    const localResult = await AssistantActionHandler.executeAction(
                        data.interpretation.intent,
                        legacyEntities as any,
                        ubicaciones
                    );
                    if (localResult.updates.length > 0) {
                        onUpdate(localResult.updates);
                    }
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        text: result.message || "✅ Acción Completada con éxito.",
                        sender: 'bot'
                    }]);
                } catch (localErr) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        text: (result.message || "✅ Acción registrada") + " (pero no pude actualizar el mapa localmente). Recarga la página.",
                        sender: 'bot'
                    }]);
                }

            } else {
                throw new Error("Estado desconocido: " + result.status);
            }

        } catch (e: any) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: `❌ Error: ${e.message}`,
                sender: 'bot'
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleCancelAction = () => {
        setMessages(prev => [...prev, { id: Date.now().toString(), text: "❌ Cancelado.", sender: 'bot' }]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSend();
    };

    if (!isOpen) return null;

    // Helper to render bold text from "**" markers
    const renderMessage = (text: string) => {
        if (!text) return null;
        // Split by "**" -> ["Hola ", "bold", " world"]
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) => {
            // Even indices are normal text, Odd are bold
            if (i % 2 === 1) return <strong key={i}>{part}</strong>;
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className={styles.window}>
            <div className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🧠 Almacenito</span>
                </div>
                <button className={styles.closeBtn} onClick={onClose}>×</button>
            </div>

            <div className={styles.messages}>
                {messages.map(msg => (
                    <div key={msg.id} className={`${styles.message} ${styles[msg.sender]}`}>
                        {msg.text && <div style={{ whiteSpace: 'pre-wrap' }}>{renderMessage(msg.text)}</div>}

                        {msg.structuredData && (
                            <ChatConfirmationBubble
                                data={msg.structuredData}
                                onConfirm={() => handleConfirmAction(msg.id)}
                                onCancel={handleCancelAction}
                            />
                        )}
                    </div>
                ))}
                {isThinking && <div className={styles.message} style={{ color: '#888', fontStyle: 'italic' }}>Pensando... 🤔</div>}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
                <button
                    className={styles.attachBtn}
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar Foto/PDF"
                >
                    📎
                </button>
                <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                />

                <input
                    ref={inputRef}
                    type="text"
                    className={styles.input}
                    placeholder="Escribe lo que has hecho..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isThinking}
                />
                <button className={styles.sendBtn} onClick={handleSend} disabled={isThinking}>➤</button>
            </div>
        </div>
    );
};
