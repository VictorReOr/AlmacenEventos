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

    // --- INDEXACIÓN DE BÚSQUEDA ---
    // ¿Memoizar o reconstruir cuando las ubicaciones cambian? 
    // Dado el tamaño, reconstruir al abrir o por efecto está bien.
    const [fuse, setFuse] = useState<Fuse<any> | null>(null);

    useEffect(() => {
        const list: any[] = [];
        Object.values(ubicaciones).forEach(u => {
            // Añadir la Ubicación en sí
            list.push({
                type: 'location',
                id: u.id,
                label: `${u.tipo === 'palet' ? 'Palet' : 'Estantería'} ${u.id}`,
                detail: u.contenido || u.programa,
                searchStr: `${u.id} ${u.contenido} ${u.programa}`
            });

            // Ayudante para procesar cajas
            const processBoxes = (boxes: any[]) => {
                boxes.forEach(box => {
                    // Indexar Caja
                    list.push({
                        type: 'caja',
                        id: u.id, // ID de la ubicación destino
                        label: box.descripcion,
                        detail: `en ${u.id} (${box.programa})`,
                        searchStr: `${box.descripcion} ${box.programa} ${box.id}`
                    });

                    // Indexar Materiales en Caja
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

            // Palés
            if (u.cajas) {
                processBoxes(u.cajas);
            }

            // Estanterías
            if (u.cajasEstanteria) {
                // Pasar tanto la caja como el slotKey (clave de ranura)
                Object.entries(u.cajasEstanteria).forEach(([slotKey, box]) => {
                    // Indexar Caja con Info de Ranura
                    list.push({
                        type: 'caja',
                        id: u.id, // Ubicación padre destino
                        label: `${box.descripcion} [${slotKey}]`,
                        detail: `en ${u.id} - ${slotKey} (${box.programa})`,
                        searchStr: `${box.descripcion} ${box.programa} ${box.id} ${slotKey} ${u.id}-${slotKey}`
                    });

                    // Indexar Materiales en Caja
                    if (box.contenido) {
                        box.contenido.forEach((m: any) => {
                            list.push({
                                type: 'material',
                                id: u.id,
                                label: m.nombre,
                                detail: `en ${box.descripcion} (${u.id} ${slotKey})`,
                                searchStr: `${m.nombre} ${m.estado} ${slotKey}`
                            });
                        });
                    }
                });
            }
        });

        const newFuse = new Fuse(list, {
            keys: ['searchStr', 'label'],
            threshold: 0.3,
            ignoreLocation: true
        });
        setFuse(newFuse);

    }, [ubicaciones]);

    // --- MANEJADORES ---
    useEffect(() => {
        if (query && fuse) {
            const res = fuse.search(query).slice(0, 8); // Limitar resultados
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

    // Clic fuera para cerrar
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

                    {/* MENÚ DESPLEGABLE DE RESULTADOS */}
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
