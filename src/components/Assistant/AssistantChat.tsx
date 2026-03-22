import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDrag } from '@use-gesture/react';
import type { Ubicacion } from '../../types';
import styles from './AssistantChat.module.css';
import { AssistantService } from '../../services/AssistantService';
import type { AssistantResponse } from '../../services/AssistantService';
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
    initialAction,
    onClearAction
}) => {
    const { token } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Hola. Soy Palessito. Puedo registrar movimientos o entradas. Escribe o sube una foto.',
            sender: 'bot'
        }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Character drag state
    const [charPos, setCharPos] = useState({ x: 0, y: 0 });
    const dragDistance = useRef(0);

    // Chat window drag state
    const [chatPos, setChatPos] = useState({ x: 0, y: 0 });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Canvas-based pixel-perfect hit test for the character
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [charImgLoaded, setCharImgLoaded] = useState(false);
    const charImgEl = useRef<HTMLImageElement>(new window.Image());

    useEffect(() => {
        const img = charImgEl.current;
        img.crossOrigin = 'anonymous';
        img.onload = () => setCharImgLoaded(true);
        img.src = almacenitoIcon;
        if (img.complete && img.naturalHeight !== 0) {
            setCharImgLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!charImgLoaded || !canvasRef.current) return;
        const img = charImgEl.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx || img.naturalWidth === 0 || img.naturalHeight === 0) return;
        
        // Mantener proporciones naturales, escalando al lado mayor = 320px
        const MAX = 320;
        const ratio = img.naturalWidth / img.naturalHeight;
        if (ratio >= 1) {
            canvas.width = MAX;
            canvas.height = Math.round(MAX / ratio);
        } else {
            canvas.height = MAX;
            canvas.width = Math.round(MAX * ratio);
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }, [charImgLoaded]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) { handleCharClick(); return; }
        // Utilizar offsetX / offsetY que el navegador calcula tomando en cuenta los CSS transforms (como el rotate/scale del hover)
        const x = Math.floor(e.nativeEvent.offsetX * (canvas.width / canvas.offsetWidth));
        const y = Math.floor(e.nativeEvent.offsetY * (canvas.height / canvas.offsetHeight));

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) { handleCharClick(); return; }
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const alpha = pixel[3];
            
            if (alpha > 128) {
                handleCharClick();
            } else {
                // Ignore click on transparent or semi-transparent shadow area
            }
        } catch (err) {
            console.error("Canvas hit testing error:", err);
            // DO NOT fallback to accepting the click. If it fails, ignore the click.
        }
    };

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
        } catch {
            setIsHovered(false);
        }
    };

    const handleCanvasPointerLeave = () => setIsHovered(false);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [messages, isOpen]);

    // --- CHARACTER DRAG ---
    const bindCharDrag = useDrag((params) => {
        // Track total drag distance to distinguish click vs drag
        dragDistance.current = Math.abs(params.movement[0]) + Math.abs(params.movement[1]);
        setCharPos({
            x: params.offset[0],
            y: params.offset[1]
        });
    }, {
        from: () => [charPos.x, charPos.y],
    });

    const handleCharClick = () => {
        // Only toggle open if it was a real click, not end of a drag
        if (dragDistance.current < 6) {
            setIsOpen(prev => !prev);
        }
        dragDistance.current = 0;
    };

    // --- CHAT WINDOW DRAG ---
    const bindWindowPosition = useDrag((params) => {
        setChatPos({
            x: params.offset[0],
            y: params.offset[1]
        });
    }, {
        from: () => [chatPos.x, chatPos.y],
    });

    // MANEJADORES DE REDIMENSIÓN MANUAL SUPERIOR IZQUIERDA
    const [size, setSize] = useState({ w: 360, h: 500 });

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startW = size.w;
        const startH = size.h;

        const onPointerMove = (eMove: PointerEvent) => {
            eMove.preventDefault();
            const deltaX = startX - eMove.clientX;
            const deltaY = startY - eMove.clientY;
            const newW = Math.max(300, startW + deltaX);
            const newH = Math.max(400, Math.min(window.innerHeight * 0.8, startH + deltaY));
            setSize({ w: newW, h: newH });
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

    // HANDLE INITIAL ACTION (Manual Entry from UI)
    useEffect(() => {
        const processInitialAction = async () => {
            if (initialAction) {
                // Auto-open when receiving an action
                setIsOpen(true);

                console.log("Processing Initial Action:", initialAction);
                setIsThinking(true);
                try {
                    if (initialAction.type === 'MANUAL_ENTRY' || initialAction.type === 'MOVE_PALLET') {
                        if (initialAction.type === 'MANUAL_ENTRY') {
                            const response = await AssistantService.submitAction(
                                'MOVEMENT',
                                initialAction.payload,
                                token || ''
                            );

                            if (response.status === 'SUCCESS') {
                                setMessages(prev => [...prev, {
                                    id: Date.now().toString(),
                                    text: `✅ Acción Registrada:\n${initialAction.payload.item} (x${initialAction.payload.qty}) en ${initialAction.payload.destination}`,
                                    sender: 'bot'
                                }]);

                                try {
                                    const entities = [
                                        { label: 'DEST_LOC', text: initialAction.payload.destination },
                                        { label: 'ITEM', text: initialAction.payload.item },
                                        { label: 'QUANTITY', text: String(initialAction.payload.qty || 1) }
                                    ];

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
                            setMessages(prev => [...prev, {
                                id: Date.now().toString(),
                                text: `🚚 Moviendo contenido de ${initialAction.payload.sourceId}. ¿A dónde lo llevamos?`,
                                sender: 'bot'
                            }]);
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
    }, [initialAction]);


    // --- HANDLERS ---

    const handleSend = async () => {
        if (!input.trim()) return;
        const text = input;
        setInput('');

        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }]);

        setIsThinking(true);
        try {
            const response = await AssistantService.parseText(text);
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

        setMessages(prev => [...prev, { id: Date.now().toString(), text: `📎 Archivo: ${file.name}`, sender: 'user' }]);
        setIsThinking(true);

        try {
            const ocrResult = await AssistantService.uploadFile(file);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: `👁️ OCR Completado:\n"${ocrResult.ocr_text}"\n\n¿Es correcto?`,
                sender: 'bot'
            }]);
            setInput(ocrResult.ocr_text.replace('[MOCK OCR] ', ''));
        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "⚠️ Error subiendo archivo.",
                sender: 'bot'
            }]);
        } finally {
            setIsThinking(false);
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
            const result = await AssistantService.confirmRequest(
                data.interpretation,
                data.token,
                token || ''
            );

            if (result.status === "PENDING_APPROVAL") {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    text: `⏳ Acción Enviada a Aprobación.\nID: ${result.transaction_id}\nUn administrador debe aprobarla.`,
                    sender: 'bot'
                }]);
            } else if (result.status === "SUCCESS") {
                try {
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

    const renderMessage = (text: string) => {
        if (!text) return null;
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) => {
            if (i % 2 === 1) return <strong key={i}>{part}</strong>;
            return <span key={i}>{part}</span>;
        });
    };

    return (
        // Outer wrapper: absolutely positioned, moves with the character drag
        <div
            className={styles.floatingRoot}
            style={{ transform: `translate(${charPos.x}px, ${charPos.y}px)` }}
        >
            {/* Character — draggable, clickable only on the image itself */}
            <div
                className={styles.character}
                {...bindCharDrag()}
                style={{ touchAction: 'none', cursor: 'grab' }}
            >
                <canvas
                    ref={canvasRef}
                    className={`${styles.characterImg} ${isHovered ? styles.characterImgHovered : ''}`}
                    onClick={handleCanvasClick}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerLeave={handleCanvasPointerLeave}
                    title="Palessito"
                    style={{ userSelect: 'none', cursor: isHovered ? 'pointer' : 'default', display: 'block' }}
                />
                {/* Tooltip with name */}
                {!isOpen && (
                    <span className={styles.charLabel}>Palessito</span>
                )}
            </div>

            {/* Chat window — shown only when open, positioned above the character */}
            {isOpen && (
                <div
                    className={styles.window}
                    style={{
                        width: size.w,
                        height: size.h,
                        transform: `translate(${chatPos.x}px, ${chatPos.y}px)`,
                        touchAction: 'none'
                    }}
                >
                    {/* Resize handle top-left */}
                    <div
                        className={styles.resizeHandleTopLeft}
                        onPointerDown={handleResizeStart}
                        title="Redimensionar Chat"
                    />

                    {/* Header — draggable */}
                    <div className={styles.header} {...bindWindowPosition()} style={{ cursor: 'grab' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={almacenitoIcon} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                            <span>Palessito</span>
                        </div>
                        <button
                            className={styles.closeBtn}
                            onClick={() => setIsOpen(false)}
                            title="Cerrar"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            ×
                        </button>
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
            )}
        </div>
    );
};
