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

const READ_ONLY_INTENTS = new Set(['QUERY', 'STATUS', 'FIND', 'LIST', 'INFO', 'UNKNOWN']);

const QUICK_REPLIES: Record<string, string[]> = {
    MOVE:    ['Otro movimiento', 'Deshacer', 'Ver mapa'],
    ADD:     ['Añadir más', 'Ver contenido'],
    GIFT:    ['Registrar otro', 'Ver mapa'],
    QUERY:   ['Buscar otro palet', 'Ver mapa'],
    ERROR:   ['Intentar de nuevo', 'Cancelar'],
    DEFAULT: ['Mover palet', 'Consultar ubicación', 'Añadir entrada'],
};

interface OpRecord {
    id: string;
    timestamp: string;
    action: string;
    description: string;
}

interface PendingOp {
    id: string;
    timestamp: string;
    interpretation: any;
    token: string;
    description: string;
}

interface Message {
    id: string;
    text?: string;
    sender: 'bot' | 'user';
    structuredData?: AssistantResponse;
    quickReplies?: string[];
    suggestions?: string[];
    contextTag?: string;
    finalText?: string;
}

// ─── Typewriter hook ───────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 16) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);
    useEffect(() => {
        setDisplayed(''); setDone(false);
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

// ─── Bot message component ─────────────────────────────────────────────────
const BotMessage: React.FC<{
    msg: Message;
    onConfirm: () => void;
    onCancel: () => void;
    onQuickReply: (t: string) => void;
    onSuggestion: (id: string) => void;
}> = ({ msg, onConfirm, onCancel, onQuickReply, onSuggestion }) => {
    const { displayed, done } = useTypewriter(msg.finalText || msg.text || '', 16);
    const textToShow = msg.finalText || msg.text;
    return (
        <div className={`${styles.message} ${styles.bot}`}>
            {msg.contextTag && <div className={styles.contextBadge}>🔗 {msg.contextTag}</div>}
            {textToShow && (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                    {displayed}{!done && <span className={styles.cursor} />}
                </div>
            )}
            {msg.structuredData && (
                <ChatConfirmationBubble data={msg.structuredData} onConfirm={onConfirm} onCancel={onCancel} />
            )}
            {done && msg.suggestions && msg.suggestions.length > 0 && (
                <div className={styles.suggestionList}>
                    <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: 4 }}>¿Quizás quisiste decir?</div>
                    {msg.suggestions.map(s => (
                        <button key={s} className={styles.suggestionBtn} onClick={() => onSuggestion(s)}>📦 {s}</button>
                    ))}
                </div>
            )}
            {done && msg.quickReplies && msg.quickReplies.length > 0 && (
                <div className={styles.quickReplies}>
                    {msg.quickReplies.map(qr => (
                        <button key={qr} className={styles.chip} onClick={() => onQuickReply(qr)}>{qr}</button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Main component ────────────────────────────────────────────────────────
export const AssistantChat: React.FC<AssistantChatProps> = ({
    ubicaciones, onUpdate, initialAction, onClearAction
}) => {
    const { token } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([{
        id: '1',
        finalText: 'Hola, soy Palessito 👋\nPuedo mover palets, registrar entradas/salidas y resolver consultas.\n¿Qué necesitas?',
        sender: 'bot',
        quickReplies: QUICK_REPLIES.DEFAULT,
    }]);
    const [isThinking, setIsThinking] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [chatPos, setChatPos] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ w: 390, h: 530 });
    const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
    const [autocomplete, setAutocomplete] = useState<string[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // ── Persisted state ──
    const [opHistory, setOpHistory] = useState<OpRecord[]>(() => {
        try { return JSON.parse(localStorage.getItem('palessito_history') || '[]'); } catch { return []; }
    });
    const [pendingOps, setPendingOps] = useState<PendingOp[]>(() => {
        try { return JSON.parse(localStorage.getItem('palessito_queue') || '[]'); } catch { return []; }
    });

    // ── Refs ──
    const undoSnapshot = useRef<Ubicacion[] | null>(null);
    const historyRef = useRef<ChatHistoryEntry[]>([]);
    const pendingSlot = useRef<{ intent?: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [charImgLoaded, setCharImgLoaded] = useState(false);
    const charImgEl = useRef<HTMLImageElement>(new window.Image());

    // ─── Voice recognition setup ──────────────────────────────────────────
    useEffect(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const r = new SR();
        r.lang = 'es-ES';
        r.continuous = false;
        r.interimResults = false;
        r.onresult = (e: any) => {
            const t = e.results[0][0].transcript;
            setInput(prev => (prev ? prev + ' ' : '') + t);
            setIsListening(false);
        };
        r.onend = () => setIsListening(false);
        r.onerror = () => setIsListening(false);
        recognitionRef.current = r;
    }, []);

    const toggleVoice = () => {
        if (!recognitionRef.current) return;
        if (isListening) { recognitionRef.current.stop(); }
        else { setIsListening(true); recognitionRef.current.start(); }
    };

    // ─── Online/offline + queue auto-sync ────────────────────────────────
    const addBotMessage = useCallback((opts: Partial<Message>) => {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', ...opts }]);
    }, []);

    useEffect(() => {
        const processQueue = async (queue: PendingOp[]) => {
            if (queue.length === 0) return;
            addBotMessage({ finalText: `📡 Conexión restaurada. Procesando ${queue.length} op${queue.length !== 1 ? 's' : ''} en cola...` });
            let ok = 0;
            for (const op of queue) {
                try { await AssistantService.confirmRequest(op.interpretation, op.token, token || ''); ok++; } catch {}
            }
            setPendingOps([]);
            localStorage.removeItem('palessito_queue');
            addBotMessage({ finalText: `✅ Cola procesada: ${ok}/${queue.length} completadas.`, quickReplies: QUICK_REPLIES.DEFAULT });
        };
        const handleOnline = () => { setIsOnline(true); processQueue(pendingOps); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, [pendingOps, token, addBotMessage]);

    // ─── Character canvas ─────────────────────────────────────────────────
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
        const MAX = 320, ratio = img.naturalWidth / img.naturalHeight;
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
            const alpha = ctx?.getImageData(x, y, 1, 1).data[3] ?? 0;
            setIsHovered(alpha > 128);
        } catch { setIsHovered(false); }
    };

    // ─── Scroll to bottom ─────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen && activeTab === 'chat') {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [messages, isOpen, activeTab]);

    // ─── Drag & resize ────────────────────────────────────────────────────
    const bindWindowPosition = useDrag((p) => { setChatPos({ x: p.offset[0], y: p.offset[1] }); }, { from: () => [chatPos.x, chatPos.y] });

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        const sx = e.clientX, sy = e.clientY, sw = size.w, sh = size.h;
        const onMove = (ev: PointerEvent) => {
            ev.preventDefault();
            setSize({ w: Math.max(300, sw + (sx - ev.clientX)), h: Math.max(400, Math.min(window.innerHeight * 0.8, sh + (sy - ev.clientY))) });
        };
        const onUp = () => { document.body.style.cursor = ''; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
        document.body.style.cursor = 'nwse-resize';
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    // ─── Autocomplete ─────────────────────────────────────────────────────
    const handleInputChange = (value: string) => {
        setInput(value);
        const lastWord = value.split(/\s+/).pop() || '';
        if (lastWord.length >= 2) {
            const matches = Object.keys(ubicaciones)
                .filter(id => id.toUpperCase().includes(lastWord.toUpperCase()))
                .slice(0, 6);
            setAutocomplete(matches);
        } else {
            setAutocomplete([]);
        }
    };

    const applyAutocomplete = (id: string) => {
        const words = input.split(/\s+/);
        words[words.length - 1] = id;
        setInput(words.join(' ') + ' ');
        setAutocomplete([]);
        inputRef.current?.focus();
    };

    // ─── Helpers ──────────────────────────────────────────────────────────
    const findFuzzyMatches = (query: string) =>
        Object.keys(ubicaciones).filter(id => id.toUpperCase().includes(query.toUpperCase().replace(/\s/g, ''))).slice(0, 4);

    const logOperation = (action: string, description: string) => {
        const record: OpRecord = { id: Date.now().toString(), timestamp: new Date().toLocaleString('es-ES'), action, description };
        const updated = [record, ...opHistory].slice(0, 50);
        setOpHistory(updated);
        localStorage.setItem('palessito_history', JSON.stringify(updated));
    };

    // ─── Send handler ─────────────────────────────────────────────────────
    const handleSend = async (text?: string) => {
        const userText = (text || input).trim();
        if (!userText) return;
        setInput('');
        setAutocomplete([]);
        setMessages(prev => [...prev, { id: Date.now().toString(), text: userText, sender: 'user' }]);
        historyRef.current = [...historyRef.current, { role: 'user', content: userText }];
        setIsThinking(true);
        try {
            const response = await AssistantService.parseText(userText, historyRef.current);
            const contextTag = pendingSlot.current?.intent ? `Completando: ${pendingSlot.current.intent}` : undefined;
            if (response.status === 'ERROR' || !response.interpretation) {
                addBotMessage({
                    finalText: response.error || 'No entendí eso. ¿Puedes reformularlo?',
                    suggestions: findFuzzyMatches(userText),
                    quickReplies: QUICK_REPLIES.ERROR,
                    contextTag,
                });
                pendingSlot.current = null;
            } else {
                const { intent, movements = [], summary } = response.interpretation;
                if (movements.length === 0 && !READ_ONLY_INTENTS.has(intent)) {
                    pendingSlot.current = { intent };
                    addBotMessage({ finalText: `Entendido. ¿Puedes darme más detalles? (ubicación, cantidad...)`, contextTag, quickReplies: ['Cancelar'] });
                } else if (READ_ONLY_INTENTS.has(intent)) {
                    pendingSlot.current = null;
                    addBotMessage({ finalText: summary || '✅ Consulta procesada.', quickReplies: QUICK_REPLIES.QUERY, contextTag });
                } else {
                    pendingSlot.current = null;
                    addBotMessage({ finalText: summary, structuredData: response, contextTag });
                }
                historyRef.current = [...historyRef.current, { role: 'assistant', content: summary || intent }];
            }
        } catch {
            addBotMessage({ finalText: '⚠️ Error de conexión con el asistente.', quickReplies: QUICK_REPLIES.ERROR });
        } finally {
            setIsThinking(false);
        }
    };

    // ─── Quick reply handler ──────────────────────────────────────────────
    const handleQuickReply = (text: string) => {
        if (text === 'Cancelar' || text === 'Cerrar') {
            pendingSlot.current = null;
            addBotMessage({ finalText: '❌ Cancelado. ¿Qué más necesitas?', quickReplies: QUICK_REPLIES.DEFAULT });
            return;
        }
        if (text === 'Ver mapa') {
            addBotMessage({ finalText: '🗺️ Usa el mapa 2D o el Modo Explorador 3D para ver la distribución.', quickReplies: QUICK_REPLIES.DEFAULT });
            return;
        }
        if (text === 'Deshacer' && undoSnapshot.current) {
            onUpdate(undoSnapshot.current);
            undoSnapshot.current = null;
            addBotMessage({ finalText: '↩️ Acción deshecha. Los palets han vuelto al estado anterior.', quickReplies: QUICK_REPLIES.DEFAULT });
            return;
        }
        if (text === 'Ver cola offline') {
            addBotMessage({
                finalText: `📡 Cola (${pendingOps.length} pendiente${pendingOps.length !== 1 ? 's' : ''}):\n` +
                    pendingOps.map(op => `• ${op.timestamp}: ${op.description}`).join('\n'),
                quickReplies: QUICK_REPLIES.DEFAULT,
            });
            return;
        }
        handleSend(text);
    };

    const handleSuggestionClick = (id: string) => handleSend(`¿Qué hay en ${id}?`);

    // ─── Confirm action ───────────────────────────────────────────────────
    const handleConfirmAction = async (msgId: string) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg?.structuredData?.interpretation || !msg.structuredData.token) return;
        const movements = msg.structuredData.interpretation.movements || [];
        const affectedIds = movements.flatMap((m: any) => [m.origin, m.destination].filter(Boolean));
        const snapshot = affectedIds.map((id: string) => ubicaciones[id]).filter(Boolean);

        // Offline: queue the operation
        if (!navigator.onLine) {
            const newOp: PendingOp = {
                id: Date.now().toString(),
                timestamp: new Date().toLocaleString('es-ES'),
                interpretation: msg.structuredData.interpretation,
                token: msg.structuredData.token,
                description: msg.structuredData.interpretation.summary || 'Operación',
            };
            const updated = [...pendingOps, newOp];
            setPendingOps(updated);
            localStorage.setItem('palessito_queue', JSON.stringify(updated));
            addBotMessage({
                finalText: `📡 Sin conexión. Guardado en cola (${updated.length} pendiente${updated.length !== 1 ? 's' : ''}).`,
                quickReplies: ['Ver cola offline'],
            });
            return;
        }

        setIsThinking(true);
        try {
            const result = await AssistantService.confirmRequest(msg.structuredData.interpretation, msg.structuredData.token, token || '');
            const intent = msg.structuredData.interpretation.intent;
            if (result.status === 'SUCCESS') {
                const legacyEntities = movements.map((mv: any) => ({ text: `${mv.origin} ${mv.destination} ${mv.item} ${mv.qty}`, label: mv.type }));
                try {
                    const local = await AssistantActionHandler.executeAction(intent, legacyEntities as any, ubicaciones);
                    if (local.updates.length > 0) { undoSnapshot.current = snapshot; onUpdate(local.updates); }
                } catch {}
                logOperation(intent, msg.structuredData.interpretation.summary || intent);
                addBotMessage({
                    finalText: result.message || '✅ Acción completada.',
                    quickReplies: ['Deshacer', ...(QUICK_REPLIES[intent] || QUICK_REPLIES.DEFAULT)],
                });
            } else if (result.status === 'PENDING_APPROVAL') {
                addBotMessage({ finalText: `⏳ Enviado a aprobación (ID: ${result.transaction_id}).`, quickReplies: QUICK_REPLIES.DEFAULT });
            }
        } catch (e: any) {
            addBotMessage({ finalText: `❌ Error: ${e.message}`, quickReplies: QUICK_REPLIES.ERROR });
        } finally {
            setIsThinking(false);
        }
    };

    const handleCancelAction = () => addBotMessage({ finalText: '❌ Cancelado. ¿Qué más necesitas?', quickReplies: QUICK_REPLIES.DEFAULT });

    // ─── File upload ──────────────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMessages(prev => [...prev, { id: Date.now().toString(), text: `📎 ${file.name}`, sender: 'user' }]);
        setIsThinking(true);
        try {
            const ocrResult = await AssistantService.uploadFile(file);
            addBotMessage({ finalText: `👁️ OCR completado:\n"${ocrResult.ocr_text}"\n¿Lo envío tal cual?`, quickReplies: ['Sí, enviar', 'Cancelar'] });
            setInput(ocrResult.ocr_text.replace('[MOCK OCR] ', ''));
        } catch {
            addBotMessage({ finalText: '⚠️ Error subiendo archivo.', quickReplies: QUICK_REPLIES.ERROR });
        } finally {
            setIsThinking(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ─── Initial action from UI ───────────────────────────────────────────
    useEffect(() => {
        if (!initialAction) return;
        setIsOpen(true);
        (async () => {
            setIsThinking(true);
            try {
                if (initialAction.type === 'MOVE_PALLET') {
                    pendingSlot.current = { intent: 'MOVE' };
                    addBotMessage({ finalText: `🚚 Mover contenido de **${initialAction.payload.sourceId}**.\n¿A qué ubicación?`, contextTag: `Origen: ${initialAction.payload.sourceId}`, quickReplies: ['Cancelar'] });
                } else if (initialAction.type === 'MANUAL_ENTRY') {
                    const response = await AssistantService.submitAction('MOVEMENT', initialAction.payload, token || '');
                    if (response.status === 'SUCCESS') {
                        addBotMessage({ finalText: `✅ ${initialAction.payload.item} (x${initialAction.payload.qty}) registrado en ${initialAction.payload.destination}.`, quickReplies: QUICK_REPLIES.ADD });
                        logOperation('ADD', `Entrada: ${initialAction.payload.item} en ${initialAction.payload.destination}`);
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

    const actionIcons: Record<string, string> = { MOVE: '🚚', ADD: '📦', GIFT: '🎁' };

    // ─── Render ───────────────────────────────────────────────────────────
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
                <div className={styles.window} style={{ width: size.w, height: size.h, transform: `translate(${chatPos.x}px, ${chatPos.y}px)`, touchAction: 'none' }}>
                    <div className={styles.resizeHandleTopLeft} onPointerDown={handleResizeStart} />

                    {/* Header */}
                    <div className={styles.header} {...bindWindowPosition()} style={{ cursor: 'grab' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={almacenitoIcon} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                            <span>Palessito</span>
                            {!isOnline && (
                                <span style={{ fontSize: '0.68rem', background: '#e53935', color: 'white', borderRadius: 8, padding: '2px 7px' }}>
                                    OFFLINE{pendingOps.length > 0 ? ` · ${pendingOps.length}` : ''}
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                                onClick={e => { e.stopPropagation(); setActiveTab('chat'); }}
                                title="Chat"
                                style={{ background: activeTab === 'chat' ? 'rgba(255,255,255,0.25)' : 'transparent', border: 'none', color: 'white', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.85rem' }}
                            >💬</button>
                            <button
                                onClick={e => { e.stopPropagation(); setActiveTab('history'); }}
                                title="Historial de operaciones"
                                style={{ background: activeTab === 'history' ? 'rgba(255,255,255,0.25)' : 'transparent', border: 'none', color: 'white', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.85rem', position: 'relative' }}
                            >
                                📋
                                {opHistory.length > 0 && (
                                    <span style={{ position: 'absolute', top: -2, right: -2, background: '#ff9800', color: 'white', fontSize: '0.58rem', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {opHistory.length > 9 ? '9+' : opHistory.length}
                                    </span>
                                )}
                            </button>
                            <button className={styles.closeBtn} onClick={() => setIsOpen(false)} onPointerDown={e => e.stopPropagation()}>×</button>
                        </div>
                    </div>

                    {/* ── TAB: Chat ── */}
                    {activeTab === 'chat' && (<>
                        <div className={styles.messages}>
                            {messages.map(msg => (
                                msg.sender === 'bot'
                                    ? <BotMessage key={msg.id} msg={msg}
                                        onConfirm={() => handleConfirmAction(msg.id)}
                                        onCancel={handleCancelAction}
                                        onQuickReply={handleQuickReply}
                                        onSuggestion={handleSuggestionClick}
                                    />
                                    : <div key={msg.id} className={`${styles.message} ${styles.user}`}>{msg.text}</div>
                            ))}
                            {isThinking && <div className={styles.typingDots}><span /><span /><span /></div>}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Autocomplete dropdown */}
                        {autocomplete.length > 0 && (
                            <div style={{ position: 'absolute', bottom: 82, left: 16, right: 16, background: 'white', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 50, overflow: 'hidden' }}>
                                {autocomplete.map(id => (
                                    <button key={id} onClick={() => applyAutocomplete(id)}
                                        style={{ width: '100%', background: 'none', border: 'none', padding: '9px 14px', textAlign: 'left', cursor: 'pointer', fontSize: '0.88rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8, color: '#333' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                    >
                                        <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>📦</span>
                                        <strong>{id}</strong>
                                        <span style={{ color: '#888', fontSize: '0.78rem', marginLeft: 'auto' }}>{ubicaciones[id]?.programa || 'Vacío'}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input area */}
                        <div className={styles.inputArea}>
                            <button className={styles.attachBtn} onClick={() => fileInputRef.current?.click()} title="Adjuntar foto/PDF">📎</button>
                            <input type="file" hidden ref={fileInputRef} accept="image/*,.pdf" onChange={handleFileUpload} />
                            <input
                                ref={inputRef}
                                type="text"
                                className={styles.input}
                                placeholder={pendingSlot.current ? `Completando ${pendingSlot.current.intent}...` : 'Escribe o habla con Palessito...'}
                                value={input}
                                onChange={e => handleInputChange(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { handleSend(); setAutocomplete([]); } if (e.key === 'Escape') setAutocomplete([]); }}
                                disabled={isThinking}
                            />
                            {/* Mic button */}
                            <button
                                onClick={toggleVoice}
                                disabled={!recognitionRef.current}
                                title={recognitionRef.current ? (isListening ? 'Escuchando... (haz clic para parar)' : 'Hablar') : 'Voz no disponible en tu navegador'}
                                style={{
                                    background: isListening ? '#e53935' : 'var(--color-primary)',
                                    color: 'white', border: 'none', borderRadius: 8,
                                    width: 48, height: 48, minWidth: 48,
                                    cursor: recognitionRef.current ? 'pointer' : 'not-allowed',
                                    fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    animation: isListening ? 'pulse 1s ease-in-out infinite' : 'none',
                                    transition: 'background 0.2s',
                                }}
                            >🎤</button>
                            <button className={styles.sendBtn} onClick={() => handleSend()} disabled={isThinking}>➤</button>
                        </div>
                    </>)}

                    {/* ── TAB: History ── */}
                    {activeTab === 'history' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--color-bg-app)' }}>
                            {opHistory.length === 0 && pendingOps.length === 0 ? (
                                <div style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
                                    Aún no hay operaciones registradas.
                                </div>
                            ) : (
                                <>
                                    {opHistory.length > 0 && (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Últimas {opHistory.length} operaciones</span>
                                                <button onClick={() => { setOpHistory([]); localStorage.removeItem('palessito_history'); }}
                                                    style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#888' }}>
                                                    Borrar
                                                </button>
                                            </div>
                                            {opHistory.map(op => (
                                                <div key={op.id} style={{ background: 'white', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 6, padding: '10px 14px', marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-primary)' }}>{actionIcons[op.action] || '✅'} {op.action}</span>
                                                        <span style={{ fontSize: '0.72rem', color: '#888' }}>{op.timestamp}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.83rem', color: '#555', marginTop: 4 }}>{op.description}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {pendingOps.length > 0 && (
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ fontWeight: 600, color: '#e53935', marginBottom: 8, fontSize: '0.88rem' }}>📡 Cola offline ({pendingOps.length})</div>
                                            {pendingOps.map(op => (
                                                <div key={op.id} style={{ background: '#fff8e1', border: '1px solid #ffc107', borderLeft: '4px solid #ffc107', borderRadius: 6, padding: '10px 14px', marginBottom: 6 }}>
                                                    <div style={{ fontSize: '0.78rem', color: '#795548', fontWeight: 600 }}>{op.timestamp}</div>
                                                    <div style={{ fontSize: '0.83rem', color: '#555' }}>{op.description}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
