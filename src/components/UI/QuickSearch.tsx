import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import type { Ubicacion } from '../../types';
import styles from './QuickSearch.module.css';

interface QuickSearchProps {
    ubicaciones: Record<string, Ubicacion>;
    onSelectLocation: (id: string) => void;
}

export const QuickSearch: React.FC<QuickSearchProps> = ({ ubicaciones, onSelectLocation }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- SEARCH INDEXING ---
    // Memoize or rebuild when ubicaciones changes? 
    // Given the size, rebuilding on open or effect is fine.
    const [fuse, setFuse] = useState<Fuse<any> | null>(null);

    useEffect(() => {
        const list: any[] = [];
        Object.values(ubicaciones).forEach(u => {
            // Add Location itself
            list.push({
                type: 'location',
                id: u.id,
                label: `${u.tipo === 'palet' ? 'Palet' : 'Estantería'} ${u.id}`,
                detail: u.contenido || u.programa,
                searchStr: `${u.id} ${u.contenido} ${u.programa}`
            });

            // Helper to process boxes
            const processBoxes = (boxes: any[]) => {
                boxes.forEach(box => {
                    // Index Box
                    list.push({
                        type: 'caja',
                        id: u.id, // Target location ID
                        label: box.descripcion,
                        detail: `en ${u.id} (${box.programa})`,
                        searchStr: `${box.descripcion} ${box.programa} ${box.id}`
                    });

                    // Index Materials in Box
                    if (box.contenido) {
                        box.contenido.forEach((m: any) => {
                            list.push({
                                type: 'material',
                                id: u.id,
                                label: m.nombre,
                                detail: `en ${box.descripcion} (${u.id})`,
                                searchStr: `${m.nombre} ${m.estado}`
                            });
                        });
                    }
                });
            };

            // Pallets
            if (u.cajas) {
                processBoxes(u.cajas);
            }

            // Shelves
            if (u.cajasEstanteria) {
                processBoxes(Object.values(u.cajasEstanteria));
            }
        });

        const newFuse = new Fuse(list, {
            keys: ['searchStr', 'label'],
            threshold: 0.3,
            ignoreLocation: true
        });
        setFuse(newFuse);

    }, [ubicaciones]);

    // --- HANDLERS ---
    useEffect(() => {
        if (query && fuse) {
            const res = fuse.search(query).slice(0, 8); // Limit results
            setResults(res.map(r => r.item));
        } else {
            setResults([]);
        }
    }, [query, fuse]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery('');
        }
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    return (
        <div ref={wrapperRef} className={`${styles.wrapper} ${isOpen ? styles.open : ''}`}>
            {!isOpen && (
                <button
                    className={styles.iconBtn}
                    onClick={() => setIsOpen(true)}
                    title="Buscar (Ctrl+K)"
                >
                    🔍
                </button>
            )}

            {isOpen && (
                <div className={styles.searchContainer}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className={styles.input}
                        placeholder="Buscar material, palet, caja..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setIsOpen(false);
                        }}
                    />
                    <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>×</button>

                    {/* RESULTS DROPDOWN */}
                    {results.length > 0 && (
                        <div className={styles.resultsMenu}>
                            {results.map((item, idx) => (
                                <button
                                    key={idx}
                                    className={styles.resultItem}
                                    onClick={() => {
                                        onSelectLocation(item.id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className={styles.resLabel}>{item.label}</div>
                                    <div className={styles.resDetail}>{item.detail}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    {query && results.length === 0 && (
                        <div className={styles.noResults}>No hay resultados</div>
                    )}
                </div>
            )}
        </div>
    );
};
