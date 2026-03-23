import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDrag } from '@use-gesture/react';
import type { Ubicacion } from '../../types';
import styles from './AssistantChat.module.css';
import { AssistantService } from '../../services/AssistantService';
import type { AssistantResponse, ChatHistoryEntry } from '../../services/AssistantService';
import { ChatConfirmationBubble } from './ChatConfirmationBubble';
import { AssistantActionHandler } from '../../services/AssistantActionHandler';
import almacenitoIcon from '../../assets/almacenito_v2.png';

interface AssistantChatProps {
    ubicaciones: Record<string, Ubicacion>;
    selectedId?: string;
    onSelectLocation: (id: string) => void;
    onUpdate: (u: Ubicacion | Ubicacion[]) => void;
    initialAction?: { type: string, payload: any } | null;
    onClearAction?: () => void;
}

// Read-only intents that don't need confirmation step
const READ_ONLY_INTENTS = new Set(['QUERY', 'STATUS', 'FIND', 'LIST', 'INFO', 'UNKNOWN']);

// Quick replies keyed by intent
const QUICK_REPLIES: Record<string, string[]> = {
    MOVE:   ['Otro movimiento', 'Ver mapa', 'Deshacer'],
    ADD:    ['Añadir más', 'Ver contenido', 'Cerrar'],
    GIFT:   ['Registrar otro regalo', 'Ver mapa'],
    QUERY:  ['Buscar otro palet', 'Ver mapa completo'],
    ERROR:  ['Intentar de nuevo', 'Cancelar'],
    DEFAULT:['Mover palet', 'Consultar ubicación', 'Añadir entrada'],
};

interface Message {
    id: string;
    text?: string;
    sender: 'bot' | 'user';
    structuredData?: AssistantResponse;
    isTyping?: boolean;
    quickReplies?: string[];
    suggestions?: string[]; // fuzzy match suggestions
    contextTag?: string;    // slot-filling badge text
    finalText?: string;     // full text for typewriter
}

// === Typewriter hook ===
function useTypewriter(text: string, speed = 18) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);
    useEffect(() => {
        setDisplayed('');
        setDone(false);
        if (!text) { setDone(true); return; }
        let i = 0;
        const id = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) { clearInterval(id); setDone(true); }
        }, speed);
        return () => clearInterval(id);
    }, [text, speed]);
    return { displayed, done };
}

// === Single bot message with typewriter ===
const BotMessage: React.FC<{
    msg: Message;
    onConfirm: () => void;
    onCancel: () => void;
    onQuickReply: (text: string) => void;
    onSuggestion: (id: string) => void;
}> = ({ msg, onConfirm, onCancel, onQuickReply, onSuggestion }) => {
    const { displayed, done } = useTypewriter(msg.finalText || msg.text || '', 16);
    const textToShow = msg.finalText || msg.text;

    return (
        <div className={`${styles.message} ${styles.bot}`}>
            {msg.contextTag && (
                <div className={styles.contextBadge}>🔗 {msg.contextTag}</div>
            )}
            {textToShow && (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                    {displayed}
                    {!done && <span className={styles.cursor} />}
                </div>
            )}
            {msg.structuredData && (
                <ChatConfirmationBubble
                    data={msg.structuredData}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                />
            )}
            {done && msg.suggestions && msg.suggestions.length > 0 && (
                <div className={styles.suggestionList}>
                    <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: 4 }}>¿Quizás quisiste decir?</div>
                    {msg.suggestions.map(s => (
                        <button key={s} className={styles.suggestionBtn} onClick={() => onSuggestion(s)}>
                            📦 {s}
                        </button>
                    ))}
                </div>
            )}
            {done && msg.quickReplies && msg.quickReplies.length > 0 && (
                <div className={styles.quickReplies}>
                    {msg.quickReplies.map(qr => (
                        <button key={qr} className={styles.chip} onClick={() => onQuickReply(qr)}>
                            {qr}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const AssistantChat: React.FC<AssistantChatProps> = ({
    ubicaciones,
    onUpdate,
    initialAction,
    onClearAction
}) => {
    const { token } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            finalText: 'Hola. Soy Palessito 👋\nPuedo mover palets, registrar entradas y salidas, y resolver consultas.\n¿Qué necesitas?',
            sender: 'bot',
            quickReplies: QUICK_REPLIES.DEFAULT,
        }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [chatPos, setChatPos] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ w: 380, h: 520 });

    // Conversation history for multi-turn context
    const historyRef = useRef<ChatHistoryEntry[]>([]);

    // Slot-filling pending context
    const pendingSlot = useRef<{ intent?: string; partialEntities?: any[] } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Canvas hit-test for character
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [charImgLoaded, setCharImgLoaded] = useState(false);
    const charImgEl = useRef<HTMLImageElement>(new window.Image());

    useEffect(() => {
        const img = charImgEl.current;
        img.crossOrigin = 'anonymous';
        img.onload = () => setCharImgLoaded(true);
        img.src = almacenitoIcon;
        if (img.complete && img.naturalHeight !== 0) setCharImgLoaded(true);
    }, []);

    useEffect(() => {
        if (!charImgLoaded || !canvasRef.current) return;
        const img = charImgEl.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx || img.naturalWidth === 0) return;
        const MAX = 320;
        const ratio = img.naturalWidth / img.naturalHeight;
        if (ratio >= 1) { canvas.width = MAX; canvas.height = Math.round(MAX / ratio); }
        else            { canvas.height = MAX; canvas.width = Math.round(MAX * ratio); }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }, [charImgLoaded]);

    const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const x = Math.floor(e.nativeEvent.offsetX * (canvas.width / canvas.offsetWidth));
        const y = Math.floor(e.nativeEvent.offsetY * (canvas.height / canvas.offsetHeight));
        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const alpha = ctx.getImageData(x, y, 1, 1).data[3];
            setIsHovered(alpha > 128);
        } catch { setIsHovered(false); }
    };

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [messages, isOpen]);

    // === Drag & resize ===
    const bindWindowPosition = useDrag((params) => {
        setChatPos({ x: params.offset[0], y: params.offset[1] });
    }, { from: () => [chatPos.x, chatPos.y] });

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onPointerMove = (eMove: PointerEvent) => {
            eMove.preventDefault();
            setSize({
                w: Math.max(300, startW + (startX - eMove.clientX)),
                h: Math.max(400, Math.min(window.innerHeight * 0.8, startH + (startY - eMove.clientY)))
            });
        };
        const onPointerUp = () => {
            document.body.style.cursor = '';
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
        document.body.style.cursor = 'nwse-resize';
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    // === Fuzzy pallet search ===
    const findFuzzyMatches = (query: string): string[] => {
        const q = query.toUpperCase().replace(/\s/g, '');
        return Object.keys(ubicaciones)
            .filter(id => id.toUpperCase().replace(/\s/g, '').includes(q))
            .slice(0, 4);
    };

    // === Bot message factory ===
    const addBotMessage = useCallback((opts: Partial<Message>) => {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            sender: 'bot',
            ...opts
        }]);
    }, []);

    // === Core send handler ===
    const handleSend = async (text?: string) => {
        const userText = (text || input).trim();
        if (!userText) return;
        setInput('');

        // Add user message
        setMessages(prev => [...prev, { id: Date.now().toString(), text: userText, sender: 'user' }]);

        // Update history
        historyRef.current = [...historyRef.current, { role: 'user', content: userText }];

        setIsThinking(true);

        try {
            const response = await AssistantService.parseText(userText, historyRef.current);

            // Slot filling: if previous slot pending, merge context
            const contextTag = pendingSlot.current?.intent
                ? `Completando: ${pendingSlot.current.intent}`
                : undefined;

            if (response.status === 'ERROR' || !response.interpretation) {
                // Try fuzzy match suggestions on the text
                const matches = findFuzzyMatches(userText);
                const errText = response.error || 'No entendí eso. ¿Puedes reformularlo?';

                addBotMessage({
                    finalText: errText,
                    suggestions: matches.length > 0 ? matches : undefined,
                    quickReplies: QUICK_REPLIES.ERROR,
                    contextTag,
                });
                pendingSlot.current = null;

            } else {
                const intent = response.interpretation.intent;
                const movements = response.interpretation.movements || [];

                // Check if we need slot-filling (no movements extracted)
                if (movements.length === 0 && !READ_ONLY_INTENTS.has(intent)) {
                    // Ask for missing info
                    pendingSlot.current = { intent };
                    addBotMessage({
                        finalText: `Entendido, quieres **${intent}**. ¿Puedes darme más detalles? (ubicación, producto, cantidad...)`,
                        contextTag,
                        quickReplies: ['Cancelar'],
                    });
                } else if (READ_ONLY_INTENTS.has(intent)) {
                    // Read-only: show answer directly without confirmation
                    pendingSlot.current = null;
                    addBotMessage({
                        finalText: response.interpretation.summary || '✅ Consulta procesada.',
                        quickReplies: QUICK_REPLIES.QUERY,
                        contextTag,
                    });
                } else {
                    // Action intent: show confirmation bubble
                    pendingSlot.current = null;
                    addBotMessage({
                        finalText: response.interpretation.summary,
                        structuredData: response,
                        quickReplies: undefined, // chips appear after confirm
                        contextTag,
                    });
                }

                // Update history with assistant turn
                historyRef.current = [...historyRef.current, {
                    role: 'assistant',
                    content: response.interpretation.summary || intent
                }];
            }
        } catch (err) {
            addBotMessage({ finalText: '⚠️ Error de conexión con el asistente.', quickReplies: QUICK_REPLIES.ERROR });
        } finally {
            setIsThinking(false);
        }
    };

    const handleQuickReply = (text: string) => {
        if (text === 'Cancelar' || text === 'Cerrar') {
            pendingSlot.current = null;
            addBotMessage({ finalText: '❌ Cancelado. ¿Necesitas algo más?', quickReplies: QUICK_REPLIES.DEFAULT });
            return;
        }
        if (text === 'Ver mapa') {
            addBotMessage({ finalText: '🗺️ Consulta el mapa 2D o el modo Explorador 3D para ver la distribución.', quickReplies: QUICK_REPLIES.DEFAULT });
            return;
        }
        handleSend(text);
    };

    const handleSuggestionClick = (id: string) => {
        handleSend(`¿Qué hay en ${id}?`);
    };

    const handleConfirmAction = async (msgId: string) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg?.structuredData?.interpretation || !msg.structuredData.token) return;
        setIsThinking(true);
        try {
            const result = await AssistantService.confirmRequest(
                msg.structuredData.interpretation, msg.structuredData.token, token || ''
            );
            const intent = msg.structuredData.interpretation.intent;
            if (result.status === 'SUCCESS') {
                const legacyEntities = msg.structuredData.interpretation.movements.map(mov => ({
                    text: `${mov.origin} ${mov.destination} ${mov.item} ${mov.qty}`,
                    label: mov.type
                }));
                try {
                    const local = await AssistantActionHandler.executeAction(intent, legacyEntities as any, ubicaciones);
                    if (local.updates.length > 0) onUpdate(local.updates);
                } catch (_) { /* optimistic update failed, ignore */ }

                addBotMessage({
                    finalText: result.message || '✅ Acción completada con éxito.',
                    quickReplies: QUICK_REPLIES[intent] || QUICK_REPLIES.DEFAULT,
                });
            } else if (result.status === 'PENDING_APPROVAL') {
                addBotMessage({
                    finalText: `⏳ Enviado a aprobación (ID: ${result.transaction_id}).`,
                    quickReplies: QUICK_REPLIES.DEFAULT,
                });
            }
        } catch (e: any) {
            addBotMessage({ finalText: `❌ Error: ${e.message}`, quickReplies: QUICK_REPLIES.ERROR });
        } finally {
            setIsThinking(false);
        }
    };

    const handleCancelAction = () => {
        addBotMessage({ finalText: '❌ Cancelado. ¿Qué más necesitas?', quickReplies: QUICK_REPLIES.DEFAULT });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMessages(prev => [...prev, { id: Date.now().toString(), text: `📎 ${file.name}`, sender: 'user' }]);
        setIsThinking(true);
        try {
            const ocrResult = await AssistantService.uploadFile(file);
            addBotMessage({
                finalText: `👁️ OCR completado:\n"${ocrResult.ocr_text}"\n¿Lo envío tal cual?`,
                quickReplies: ['Sí, enviar', 'Cancelar'],
            });
            setInput(ocrResult.ocr_text.replace('[MOCK OCR] ', ''));
        } catch {
            addBotMessage({ finalText: '⚠️ Error subiendo archivo.', quickReplies: QUICK_REPLIES.ERROR });
        } finally {
            setIsThinking(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // === INITIAL ACTION from UI ===
    useEffect(() => {
        if (!initialAction) return;
        setIsOpen(true);
        (async () => {
            setIsThinking(true);
            try {
                if (initialAction.type === 'MOVE_PALLET') {
                    pendingSlot.current = { intent: 'MOVE' };
                    addBotMessage({
                        finalText: `🚚 Mover contenido de **${initialAction.payload.sourceId}**.\n¿A qué ubicación lo llevamos?`,
                        contextTag: `Origen: ${initialAction.payload.sourceId}`,
                        quickReplies: ['Cancelar'],
                    });
                } else if (initialAction.type === 'MANUAL_ENTRY') {
                    const response = await AssistantService.submitAction('MOVEMENT', initialAction.payload, token || '');
                    if (response.status === 'SUCCESS') {
                        addBotMessage({
                            finalText: `✅ ${initialAction.payload.item} (x${initialAction.payload.qty}) registrado en ${initialAction.payload.destination}.`,
                            quickReplies: QUICK_REPLIES.ADD,
                        });
                    } else {
                        throw new Error(response.error || 'Error');
                    }
                }
            } catch (e: any) {
                addBotMessage({ finalText: `❌ ${e.message}`, quickReplies: QUICK_REPLIES.ERROR });
            } finally {
                setIsThinking(false);
                if (onClearAction) onClearAction();
            }
        })();
    }, [initialAction]);

    return (
        <div className={styles.floatingRoot}>
            {/* Character */}
            <div className={styles.character} style={{ touchAction: 'none', cursor: 'pointer' }} onClick={() => setIsOpen(p => !p)}>
                <canvas
                    ref={canvasRef}
                    className={`${styles.characterImg} ${isHovered ? styles.characterImgHovered : ''}`}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerLeave={() => setIsHovered(false)}
                    title="Palessito"
                    style={{ userSelect: 'none', display: 'block' }}
                />
                {!isOpen && <span className={styles.charLabel}>Abrir chat</span>}
            </div>

            {/* Chat window */}
            {isOpen && (
                <div
                    className={styles.window}
                    style={{ width: size.w, height: size.h, transform: `translate(${chatPos.x}px, ${chatPos.y}px)`, touchAction: 'none' }}
                >
                    <div className={styles.resizeHandleTopLeft} onPointerDown={handleResizeStart} title="Redimensionar" />

                    {/* Header */}
                    <div className={styles.header} {...bindWindowPosition()} style={{ cursor: 'grab' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={almacenitoIcon} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                            <span>Palessito</span>
                        </div>
                        <button className={styles.closeBtn} onClick={() => setIsOpen(false)} onPointerDown={e => e.stopPropagation()}>×</button>
                    </div>

                    {/* Messages */}
                    <div className={styles.messages}>
                        {messages.map(msg => (
                            msg.sender === 'bot'
                                ? <BotMessage
                                    key={msg.id}
                                    msg={msg}
                                    onConfirm={() => handleConfirmAction(msg.id)}
                                    onCancel={handleCancelAction}
                                    onQuickReply={handleQuickReply}
                                    onSuggestion={handleSuggestionClick}
                                />
                                : <div key={msg.id} className={`${styles.message} ${styles.user}`}>
                                    {msg.text}
                                </div>
                        ))}
                        {isThinking && (
                            <div className={styles.typingDots}>
                                <span /><span /><span />
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className={styles.inputArea}>
                        <button className={styles.attachBtn} onClick={() => fileInputRef.current?.click()} title="Adjuntar Foto/PDF">📎</button>
                        <input type="file" hidden ref={fileInputRef} accept="image/*,.pdf" onChange={handleFileUpload} />
                        <input
                            ref={inputRef}
                            type="text"
                            className={styles.input}
                            placeholder={pendingSlot.current ? `Completando ${pendingSlot.current.intent}...` : 'Escribe o habla con Palessito...'}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                            disabled={isThinking}
                        />
                        <button className={styles.sendBtn} onClick={() => handleSend()} disabled={isThinking}>➤</button>
                    </div>
                </div>
            )}
        </div>
    );
};
