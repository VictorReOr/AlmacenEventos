import React, { useState, useRef, useEffect } from 'react';
import type { Ubicacion } from '../types';
import Fuse from 'fuse.js';
import './Chatbot.css';

interface ChatbotProps {
    ubicaciones: Record<string, Ubicacion>;
    onSelectLocation: (id: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

interface Message {
    id: string;
    text: string;
    sender: 'bot' | 'user';
    results?: { id: string, name: string }[];
}

export const Chatbot: React.FC<ChatbotProps> = ({ ubicaciones, onSelectLocation, isOpen, onClose }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: '¡Hola! ¿Qué material estás buscando hoy?', sender: 'bot' }
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // Synonym Dictionary
    const SYNONYMS: Record<string, string[]> = {
        'adidas': ['ropa', 'textil', 'calzado'],
        'nike': ['ropa', 'textil', 'calzado'],
        'babolat': ['raquetas', 'tenis', 'pádel'],
        'wilson': ['raquetas', 'tenis', 'balones'],
        'raqueta': ['babolat', 'wilson', 'head'],
        'chisme': ['herramientas', 'varios', 'trastos'],
        'pelota': ['balones', 'bolas'],
        // Add more as needed
    };

    const handleSearch = () => {
        if (!input.trim()) return;

        const originalQuery = input.toLowerCase().trim();
        const userMsg: Message = { id: Date.now().toString(), text: input, sender: 'user' };

        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // 1. Expand Query with Synonyms
        let searchTerms = [originalQuery];
        Object.entries(SYNONYMS).forEach(([key, synonyms]) => {
            if (originalQuery.includes(key) || key.includes(originalQuery)) { // Basic check
                searchTerms.push(...synonyms);
            }
        });
        // Also check if any synonym matches the query inverted
        Object.entries(SYNONYMS).forEach(([key, synonyms]) => {
            if (synonyms.some(s => originalQuery.includes(s))) {
                searchTerms.push(key);
            }
        });

        // Deduplicate
        searchTerms = Array.from(new Set(searchTerms));

        // 2. Prepare Data for Fuse
        const allUbicaciones = Object.values(ubicaciones).filter(u => u.tipo === 'palet' || u.tipo === 'estanteria_modulo');

        const fuseOptions = {
            keys: ['id', 'programa', 'contenido'],
            threshold: 0.3, // Tolerance (0.0 = exact, 1.0 = match anything)
            distance: 100,
            minMatchCharLength: 2,
            ignoreLocation: true
        };

        const fuse = new Fuse<Ubicacion>(allUbicaciones, fuseOptions);

        // 3. Search for ALL terms
        let allMatches: Ubicacion[] = [];
        searchTerms.forEach(term => {
            const results = fuse.search(term);
            allMatches.push(...results.map(r => r.item));
        });

        // Deduplicate matches by ID
        const uniqueMatchesMap = new Map();
        allMatches.forEach(item => {
            uniqueMatchesMap.set(item.id, item);
        });

        const matches = Array.from(uniqueMatchesMap.values()).map(u => ({
            id: u.id,
            name: `${u.programa} (${u.contenido})`
        }));


        setTimeout(() => {
            let botText = '';
            let results = undefined;

            if (matches.length === 0) {
                botText = `No he encontrado nada para "${originalQuery}" (ni buscando por: ${searchTerms.join(', ')}).`;
            } else if (matches.length === 1) {
                botText = `He encontrado 1 resultado para "${originalQuery}":`;
                results = matches;
            } else {
                botText = `He encontrado ${matches.length} coincidencias:`;
                results = matches.slice(0, 10);
                if (matches.length > 10) botText += ' (mostrando las top 10)';
            }

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: botText,
                sender: 'bot',
                results
            };
            setMessages(prev => [...prev, botMsg]);
        }, 500);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleResultClick = (id: string, name: string) => {
        onSelectLocation(id);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: `Mostrando: ${name}`,
            sender: 'bot'
        }]);
    };

    return (
        <div className="chatbot-container" style={{ pointerEvents: 'none' }}>
            {/* Pointer events none on container so it doesn't block if we make it full screen or something, 
                but we need pointer-events auto on the window. 
                Actually, the container is fixed bottom left. If we remove the button, we might need to adjust CSS.
                For now let's keep it simple.
            */}
            {isOpen && (
                <div className="chatbot-window" style={{ pointerEvents: 'auto' }}>
                    <div className="chatbot-header">
                        <span>Asistente de Almacén</span>
                        <button onClick={onClose}>✖</button>
                    </div>
                    <div className="chatbot-messages">
                        {messages.map(msg => (
                            <div key={msg.id} className={`message ${msg.sender}`}>
                                <div>{msg.text}</div>
                                {msg.results && (
                                    <div style={{ marginTop: 5 }}>
                                        {msg.results.map(res => (
                                            <div
                                                key={res.id}
                                                className="result-link"
                                                onClick={() => handleResultClick(res.id, res.name)}
                                            >
                                                📍 {res.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="chatbot-input">
                        <input
                            type="text"
                            placeholder="Buscar material..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <button onClick={handleSearch}>➤</button>
                    </div>
                </div>
            )}
        </div>
    );
};
