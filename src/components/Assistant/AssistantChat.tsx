import React, { useState, useRef, useEffect } from 'react';
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
}) => {
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
        if (!data) return;

        setIsThinking(true);
        try {
            const result = await AssistantActionHandler.executeAction(data.intent, data.entities as any, ubicaciones);

            // 1. Update App State (React + Sheets)
            if (result.updates.length > 0) {
                onUpdate(result.updates);
            }

            // 2. Show Success Message
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: result.message,
                sender: 'bot'
            }]);

        } catch (e: any) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: `❌ Error ejecutando acción: ${e.message}`,
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
                        {msg.text && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>}

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
