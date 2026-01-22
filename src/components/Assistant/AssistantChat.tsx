import React, { useState, useRef, useEffect } from 'react';
import type { Ubicacion, Caja } from '../../types';
import Fuse from 'fuse.js';
import styles from './AssistantChat.module.css';

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
    text: string;
    sender: 'bot' | 'user';
    results?: { id: string, name: string }[];
    actions?: { label: string, onClick: () => void }[];
}

type FlowState =
    | 'IDLE'
    | 'SEARCH_MODE'
    | 'PLACE_ASK_MATERIAL'
    | 'PLACE_ASK_QUANTITY'
    | 'PLACE_CONFIRM'
    | 'MANAGE_SELECTED'      // Menu for a selected item (Move, Empty, Edit)
    | 'MOVE_ASK_DESTINATION' // Waiting for user to click destination or type ID (Pallet Move)
    | 'MOVE_CONFIRM'
    | 'MOVE_BOX_DESTINATION' // Waiting for user to click destination for a Box
    | 'MOVE_BOX_CONFIRM';

export const AssistantChat: React.FC<AssistantChatProps> = ({
    ubicaciones,
    selectedId,
    onSelectLocation,
    onUpdate,
    isOpen,
    onClose,
    initialAction,
    onClearAction
}) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Panel de Operaciones Listo. Seleccione una tarea o introduzca una orden.',
            sender: 'bot',
            actions: [
                { label: 'Buscar Material', onClick: () => { } },
                { label: 'Ubicar Entrada', onClick: () => { } }
            ]
        }
    ]);

    // State Machine
    const [flowState, setFlowState] = useState<FlowState>('IDLE');
    const [tempData, setTempData] = useState<{
        material?: string,
        quantity?: string,
        targetId?: string,
        sourceId?: string,
        boxId?: string,         // For moving specific box
        boxName?: string,
        shelfContext?: { module: number, level: number }
    }>({});

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // --- EXTERNAL ACTION HANDLER ---
    useEffect(() => {
        if (initialAction && isOpen) {
            console.log("Assistant received action:", initialAction);
            if (initialAction.type === 'MOVE_PALLET') {
                const { sourceId } = initialAction.payload;
                startMoveFlow(sourceId);
            } else if (initialAction.type === 'MOVE_BOX') {
                const { sourceLocationId, boxId, boxName, shelfContext } = initialAction.payload;
                startMoveBoxFlow(sourceLocationId, boxId, boxName, shelfContext);
            }
            // Clear action so it doesn't re-trigger
            if (onClearAction) onClearAction();
        }
    }, [initialAction, isOpen]);


    // --- SELECTION REACTION ---
    useEffect(() => {
        if (isOpen && selectedId && flowState === 'IDLE') {
            const u = ubicaciones[selectedId];
            if (u && u.tipo === 'palet' && u.programa !== 'Vacio') {
                setFlowState('MANAGE_SELECTED');
                setTempData(prev => ({ ...prev, sourceId: selectedId }));
                addBotMessage(`Ubicación ${selectedId} seleccionada. Contenido: ${u.contenido}. Operaciones disponibles:`, [
                    { label: 'Mover Palet', onClick: () => startMoveFlow(selectedId) },
                    { label: 'Vaciar Ubicación', onClick: () => emptyLocation(selectedId) },
                    { label: 'Cancelar', onClick: () => cancelFlow() }
                ]);
            }
        }
        else if (isOpen && selectedId && flowState === 'MOVE_ASK_DESTINATION') {
            // User clicked a destination for PALLET
            const u = ubicaciones[selectedId];
            if (u && u.programa === 'Vacio') {
                setFlowState('MOVE_CONFIRM');
                setTempData(prev => ({ ...prev, targetId: selectedId }));
                addBotMessage(`Confirmar movimiento: ${tempData.sourceId} -> ${selectedId}`, [
                    { label: 'Confirmar Mover', onClick: () => confirmMove(tempData.sourceId!, selectedId) },
                    { label: 'Cancelar', onClick: () => cancelFlow() }
                ]);
            } else if (u) {
                addBotMessage(`Error: La ubicación ${selectedId} está ocupada.`);
            }
        }
        else if (isOpen && selectedId && flowState === 'MOVE_BOX_DESTINATION') {
            // User clicked destination for BOX
            /*
             Logic:
             If target is Pallet: Append to list (if has space? assume infinite for now)
             If target is Shelf: Need to know MODULE/LEVEL. 
             Ideally we would open a sub-dialog or ask "Which Slot?".
             For MVP: If shelf, just put in first empty slot or fail.
            */

            const u = ubicaciones[selectedId];
            if (u) {
                setFlowState('MOVE_BOX_CONFIRM');
                setTempData(prev => ({ ...prev, targetId: selectedId }));
                addBotMessage(`¿Mover caja "${tempData.boxName}" a ${selectedId}?`, [
                    { label: '✅ Sí, Mover', onClick: () => confirmMoveBox(tempData.sourceId!, selectedId, tempData.boxId!, tempData.shelfContext) },
                    { label: '❌ No', onClick: () => cancelFlow() }
                ]);
            }
        }
    }, [selectedId, isOpen, ubicaciones]);


    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [messages, isOpen]);

    // --- LOGIC HELPERS ---
    const addBotMessage = (text: string, actions?: Message['actions'], results?: Message['results']) => {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text,
            sender: 'bot',
            actions,
            results
        }]);
    };

    const findFreeSpot = (excludeId?: string): string | null => {
        const allIds = Object.keys(ubicaciones).sort((a, b) => parseInt(a) - parseInt(b));
        for (const id of allIds) {
            if (id === excludeId) continue;
            const u = ubicaciones[id];
            if (u.tipo === 'palet' && u.programa === 'Vacio') {
                return id;
            }
        }
        return null;
    };

    // --- ACTIONS ---
    const startMoveFlow = (sourceId: string) => {
        setFlowState('MOVE_ASK_DESTINATION');
        setTempData(prev => ({ ...prev, sourceId: sourceId }));
        addBotMessage('Selecciona un palet VACÍO en el mapa para moverlo allí (o escribe su ID).');

        const suggestion = findFreeSpot(sourceId);
        if (suggestion) {
            addBotMessage(`Sugerencia: El palet ${suggestion} está libre.`, [
                { label: `Ir al ${suggestion}`, onClick: () => onSelectLocation(suggestion) }
            ]);
        }
    };

    const startMoveBoxFlow = (sourceId: string, boxId: string, boxName: string, shelfContext?: any) => {
        setFlowState('MOVE_BOX_DESTINATION');
        setTempData({ sourceId, boxId, boxName, shelfContext });
        addBotMessage(`MOVER CAJA "${boxName}". Selecciona el destino en el mapa (Palet o Estantería).`);
    };

    const confirmMove = (sourceId: string, targetId: string) => {
        const source = ubicaciones[sourceId];
        const target = ubicaciones[targetId];

        if (!source || !target) {
            addBotMessage('Error: Ubicaciones no válidas.');
            cancelFlow();
            return;
        }

        const updates = [
            // Target becomes Source
            {
                ...target,
                programa: source.programa,
                contenido: source.contenido,
                notas: source.notas,
                cajas: source.cajas,
                cajasEstanteria: source.cajasEstanteria // Should be undefined for pallet but safe to copy
            },
            // Source becomes Empty
            {
                ...source,
                programa: 'Vacio',
                contenido: source.id,
                notas: '',
                cajas: [],
                cajasEstanteria: {}
            }
        ];

        onUpdate(updates);
        cancelFlow();
        addBotMessage(`✅ Movido correctamente de ${sourceId} a ${targetId}.`);
    };

    const confirmMoveBox = (sourceId: string, targetId: string, boxId: string, shelfContext?: { module: number, level: number }) => {
        const source = ubicaciones[sourceId];
        const target = ubicaciones[targetId];

        if (!source || !target) {
            addBotMessage('Error: Ubicaciones incorrectas.');
            cancelFlow();
            return;
        }

        // 1. EXTRACT Box from Source
        let boxItem: Caja | undefined;
        let newSourceBoxes: Caja[] = [];
        let newSourceShelfBoxes = { ...(source.cajasEstanteria || {}) };

        // Helper to find and remove
        const removeFromArray = (list: Caja[]) => {
            const found = list.find(i => i.id === boxId);
            if (found) boxItem = found;
            return list.filter(i => i.id !== boxId);
        };

        if (shelfContext) {
            // It's in a specific shelf slot
            const key = `M${shelfContext.module}-A${shelfContext.level}`;
            if (newSourceShelfBoxes[key]) {
                const b = newSourceShelfBoxes[key];
                if (b.id === boxId) {
                    boxItem = b;
                    delete newSourceShelfBoxes[key];
                }
            }
        } else {
            // Standard pallet list
            newSourceBoxes = removeFromArray(source.cajas || []);
        }

        if (!boxItem) {
            addBotMessage("Error: No encuentro esa caja en el origen. ¿Ya se movió?");
            cancelFlow();
            return;
        }

        // 2. ADD Box to Target
        let newTargetBoxes = [...(target.cajas || [])];
        let newTargetShelfBoxes = { ...(target.cajasEstanteria || {}) };

        const isTargetShelf = target.tipo === 'estanteria_modulo';

        if (isTargetShelf) {
            // Need to find first empty slot
            // Assumption: Generic shelf has 4 modules, 4 levels? Or logic from props?
            // Let's hardcode search for generic dimensions or just put in M1-A1 if free
            let placed = false;
            // Try to find a free spot
            for (let m = 1; m <= 6; m++) {
                for (let l = 1; l <= 4; l++) {
                    const key = `M${m}-A${l}`;
                    if (!newTargetShelfBoxes[key]) {
                        newTargetShelfBoxes[key] = boxItem;
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
            if (!placed) {
                addBotMessage("❌ La estantería destino está llena.");
                cancelFlow();
                return;
            }

        } else {
            newTargetBoxes.push(boxItem);
        }


        // 3. Updates
        const updates: Ubicacion[] = [];

        // Update Source
        const updatedSource = { ...source };
        if (shelfContext) {
            updatedSource.cajasEstanteria = newSourceShelfBoxes;
        } else {
            updatedSource.cajas = newSourceBoxes;
        }
        updates.push(updatedSource);

        // Update Target
        const updatedTarget = { ...target };
        if (isTargetShelf) {
            updatedTarget.cajasEstanteria = newTargetShelfBoxes;
        } else {
            updatedTarget.cajas = newTargetBoxes;
            // If target was empty/Vacío
            if (updatedTarget.programa === 'Vacio') {
                updatedTarget.programa = boxItem.programa;
                updatedTarget.contenido = "Cajas Varias";
            }
        }
        updates.push(updatedTarget);

        onUpdate(updates);
        cancelFlow();
        addBotMessage(`✅ Caja movida a ${targetId}.`);
    };

    const emptyLocation = (id: string) => {
        const u = ubicaciones[id];
        if (u) {
            const updated = {
                ...u,
                programa: 'Vacio',
                contenido: u.id,
                notas: '',
                cajas: [],
                cajasEstanteria: {}
            };
            onUpdate([updated]);
            cancelFlow();
            addBotMessage(`🗑️ La ubicación ${id} ha sido vaciada.`);
        }
    };

    // --- FLOW HANDLER ---
    const processInput = (text: string) => {
        const lower = text.toLowerCase().trim();

        if (lower === 'cancelar' || lower === 'inicio') {
            cancelFlow();
            return;
        }

        switch (flowState) {
            case 'IDLE':
                if (lower.includes('buscar')) {
                    setFlowState('SEARCH_MODE');
                    handleSearch(text);
                } else if (lower.includes('ubicar')) {
                    setFlowState('PLACE_ASK_MATERIAL');
                    addBotMessage('¿Qué material es? (Ej: "Cables HDMI")');
                } else {
                    handleSearch(text);
                }
                break;

            case 'SEARCH_MODE':
                handleSearch(text);
                break;

            case 'PLACE_ASK_MATERIAL':
                setTempData(prev => ({ ...prev, material: text }));
                setFlowState('PLACE_ASK_QUANTITY');
                addBotMessage(`¿Cantidad / Cajas?`);
                break;

            case 'PLACE_ASK_QUANTITY':
                const spotId = findFreeSpot();
                if (!spotId) {
                    cancelFlow();
                    addBotMessage('⚠️ No hay huecos libres.');
                    return;
                }
                setTempData(prev => ({ ...prev, quantity: text, targetId: spotId }));
                setFlowState('PLACE_CONFIRM');
                onSelectLocation(spotId);
                addBotMessage(`Sitio libre en ${spotId}. ¿Guardar?`, [
                    { label: '✅ Confirmar', onClick: () => confirmPlacement(spotId, tempData.material!, text) },
                    { label: '❌ Cancelar', onClick: () => cancelFlow() }
                ]);
                break;

            case 'MOVE_ASK_DESTINATION':
                // Check if user typed an ID
                const possibleId = Object.keys(ubicaciones).find(id => id === text || id === text.toUpperCase());
                if (possibleId) {
                    const u = ubicaciones[possibleId];
                    if (u.programa === 'Vacio') {
                        setFlowState('MOVE_CONFIRM');
                        setTempData(prev => ({ ...prev, targetId: possibleId }));
                        addBotMessage(`¿Mover a ${possibleId}?`, [
                            { label: '✅ Sí', onClick: () => confirmMove(tempData.sourceId!, possibleId) },
                            { label: '❌ No', onClick: () => cancelFlow() }
                        ]);
                    } else {
                        addBotMessage(`La ubicación ${possibleId} está ocupada.`);
                    }
                } else {
                    addBotMessage('No encuentro esa ID. Selecciona en el mapa.');
                }
                break;

            case 'MOVE_BOX_DESTINATION':
                const destId = Object.keys(ubicaciones).find(id => id === text || id === text.toUpperCase());
                if (destId) {
                    setFlowState('MOVE_BOX_CONFIRM');
                    setTempData(prev => ({ ...prev, targetId: destId }));
                    addBotMessage(`¿Mover caja a ${destId}?`, [
                        { label: '✅ Sí', onClick: () => confirmMoveBox(tempData.sourceId!, destId, tempData.boxId!, tempData.shelfContext) },
                        { label: '❌ No', onClick: () => cancelFlow() }
                    ]);
                } else {
                    addBotMessage("No encuentro esa ubicación. Intenta hacer clic en el mapa.");
                }
                break;

        }
    };

    const confirmPlacement = (id: string, material: string, quantity: string) => {
        // Logic needs update? This implies creating a pallet with generic content?
        const u = ubicaciones[id];
        if (u) {
            const updated = {
                ...u,
                programa: 'Otros',
                contenido: `${material} (${quantity})`,
                notas: `Asistente: ${new Date().toLocaleDateString()}`,
                cajas: [] // Or should we add dummy boxes? For now plain text in 'contenido' matches old logic relative to 'Palet'. 
                // BUT, pure data model says 'Palet' contains 'Cajas'. 
                // Let's create a default box.
            };

            // Auto-create box wrapper
            const newBox: Caja = {
                id: `C-${crypto.randomUUID().slice(0, 4)}`,
                descripcion: material,
                programa: 'Otros',
                contenido: [{ id: crypto.randomUUID(), nombre: material, cantidad: parseInt(quantity) || 1, estado: 'operativo', materialId: 'gen' }]
            };
            updated.cajas = [newBox];

            onUpdate(updated);
            cancelFlow();
            addBotMessage(`✅ Guardado ${material} en ${id}.`);
        }
    };

    const cancelFlow = () => {
        setFlowState('IDLE');
        setTempData({});
        addBotMessage('¿Algo más?');
    };

    const handleSearch = (query: string) => {
        const allUbicaciones = Object.values(ubicaciones).filter(u => u.tipo === 'palet' || u.tipo === 'estanteria_modulo');

        // Flatten Searchable Index (Items within pallets also searchable)
        const searchableItems: any[] = [];
        allUbicaciones.forEach(u => {
            searchableItems.push({ ...u, _searchLabel: `${u.id} ${u.contenido}` });

            // Search in Boxes (Pallet)
            if (u.cajas) {
                u.cajas.forEach(b => searchableItems.push({
                    id: u.id,
                    contenido: b.descripcion,
                    _searchLabel: `Caja en ${u.id}: ${b.descripcion}`
                }));
            }
            // Search in Boxes (Shelf)
            if (u.cajasEstanteria) {
                Object.values(u.cajasEstanteria).forEach(b => searchableItems.push({
                    id: u.id,
                    contenido: b.descripcion,
                    _searchLabel: `Estantería ${u.id}: ${b.descripcion}`
                }));
            }
        });

        const fuse = new Fuse(searchableItems, { keys: ['id', 'programa', 'contenido', '_searchLabel'], threshold: 0.3 });
        const results = fuse.search(query).map(r => r.item).slice(0, 5);

        if (results.length > 0) {
            addBotMessage(`Encontrado:`, undefined, results.map(u => ({ id: u.id, name: u._searchLabel || `${u.programa}: ${u.contenido}` })));
        } else {
            addBotMessage(`No encontré nada para "${query}".`);
        }
    };

    // --- UI HANDLERS ---
    const handleSend = () => {
        if (!input.trim()) return;
        const text = input;
        setInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }]);
        setTimeout(() => processInput(text), 400);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSend();
    };

    const handleDynamicAction = (action: { label: string, onClick: () => void }) => {
        if (action.label.includes("Buscar")) {
            setFlowState('SEARCH_MODE');
            addBotMessage('¿Qué buscas?');
        } else if (action.label.includes("Ubicar")) {
            setFlowState('PLACE_ASK_MATERIAL');
            addBotMessage('¿Qué material es?');
        } else {
            action.onClick();
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.window}>
            <div className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Operaciones</span>
                    {flowState !== 'IDLE' && <span className={styles.badge}>{flowState}</span>}
                </div>
                <button className={styles.closeBtn} onClick={onClose}>×</button>
            </div>

            <div className={styles.messages}>
                {messages.map(msg => (
                    <div key={msg.id} className={`${styles.message} ${styles[msg.sender]}`}>
                        <div>{msg.text}</div>
                        {msg.results && (
                            <div className={styles.resultsList}>
                                {msg.results.map(res => (
                                    <button
                                        key={res.id}
                                        className={styles.resultLink}
                                        onClick={() => onSelectLocation(res.id)}
                                    >
                                        📍 {res.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        {msg.actions && (
                            <div className={styles.actionsList}>
                                {msg.actions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        className={styles.actionBtn}
                                        onClick={() => handleDynamicAction(action)}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
                <input
                    ref={inputRef}
                    type="text"
                    className={styles.input}
                    placeholder={flowState === 'IDLE' ? "Escribe..." : "Responde..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button className={styles.sendBtn} onClick={handleSend}>➤</button>
            </div>
        </div>
    );
};
