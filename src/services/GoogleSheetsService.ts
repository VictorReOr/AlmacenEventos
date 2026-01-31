
import type { AlmacenState } from '../types';

export const GoogleSheetsService = {

    // Load data from Google Sheet
    // baseState: Optional default state to populate with cloud inventory (if configJson is missing)
    async load(scriptUrl: string, baseState?: AlmacenState): Promise<AlmacenState | null> {
        try {
            const response = await fetch(scriptUrl, { method: 'GET' });
            const data: any = await response.json();

            console.log("☁️ CLOUD DATA RAW RESPONSE:", data);

            if (data.status === 'success') {
                // 1. Initialize loadedState
                // If we have a baseState (code defaults), use it as the starting point.
                // Otherwise start empty.
                let loadedState: AlmacenState = baseState ? JSON.parse(JSON.stringify(baseState)) : {
                    ubicaciones: {},
                    geometry: []
                };

                // If cloud has explicit geometry/config, it overrides/augments the base
                if (data.geometry && data.geometry.length > 0) {
                    loadedState.geometry = data.geometry;
                }

                if (data.configJson) {
                    try {
                        const parsedConfig = JSON.parse(data.configJson);
                        // Merge config, carefully preserving existing object references if needed, 
                        // but here we just spread.
                        loadedState = { ...loadedState, ...parsedConfig };
                    } catch (e) {
                        console.error("Error parsing Config JSON", e);
                    }
                }

                // 2. Apply Relational Inventory
                // data.inventoryRows is now an Array of { id, tipo, contenido, cantidad, programa }
                const rows = data.inventoryRows || [];

                // Reset items to empty arrays first (to avoid stale data if re-loading)
                // BUT only if we are treating this as a fresh load for those locations
                if (loadedState.ubicaciones) {
                    Object.values(loadedState.ubicaciones).forEach(u => {
                        u.items = [];
                        u.shelfItems = {};
                        // Clear legacy content string if we are driving purely by rows?
                        // Let's keep it simply: We clear the containers to fill them from rows.
                    });
                }

                rows.forEach((row: any) => {
                    const rowId = row.id;
                    const item: any = {
                        id: crypto.randomUUID(), // Local unique ID for React keys
                        tipo: row.tipo,
                        contenido: row.contenido,
                        descripcion: row.contenido, // Map content to description for UI compatibility
                        cantidad: Number(row.cantidad) || 1,
                        programa: row.programa
                    };

                    // Check for Shelf Sub-Location (E1-M1-A1 or similar)
                    // Flexible match: Look for anything ending in -M#-A#
                    console.log(`[InvLoad] Row: ${rowId} | Tipo: ${row.tipo}`);

                    const shelfMatch = rowId.match(/^(.+)-M(\d+)-A(\d+)$/i);

                    if (shelfMatch) {
                        let parentId = shelfMatch[1];
                        const subKey = 'M' + shelfMatch[2] + '-A' + shelfMatch[3]; // M1-A1

                        // Alias Check for E1 -> E-1 mismatch
                        if (!loadedState.ubicaciones[parentId]) {
                            // Try hyphenated version for shelves (E1 -> E-1)
                            const matchE = parentId.match(/^E(\d+)$/i);
                            if (matchE) {
                                const alias = `E-${matchE[1]}`;
                                if (loadedState.ubicaciones[alias]) {
                                    parentId = alias;
                                    console.log(`[InvLoad] Resolved alias ${shelfMatch[1]} -> ${parentId}`);
                                }
                            }
                        }

                        if (loadedState.ubicaciones[parentId]) {
                            const parent = loadedState.ubicaciones[parentId];
                            if (!parent.shelfItems) parent.shelfItems = {};
                            if (!parent.shelfItems[subKey]) parent.shelfItems[subKey] = [];

                            parent.shelfItems[subKey].push(item);
                            // console.log(` -> Added to Shelf ${parentId} [${subKey}]`);
                        } else {
                            console.warn(` -> Parent Shelf ${parentId} NOT FOUND for row ${rowId}. Available keys:`, Object.keys(loadedState.ubicaciones).filter(k => k.startsWith('E')));
                        }
                    } else {
                        // Standard Pallet OR Fallback for malformed shelf IDs
                        // If ID exists directly in map (e.g. "E1" directly?), treat as generic container?
                        // For now, standard pallet behavior matches ID to Ubicacion ID.
                        if (loadedState.ubicaciones[rowId]) {
                            const u = loadedState.ubicaciones[rowId];
                            if (!u.items) u.items = [];
                            u.items.push(item);

                            // Legacy sync
                            if (!u.contenido) u.contenido = item.contenido;
                        } else {
                            // If it starts with E, maybe it belongs to a shelf but missing strict format?
                            if (rowId.startsWith('E')) {
                                console.warn(`[InvLoad] Orphaned Item starting with E: ${rowId}`);
                            }
                        }
                    }
                });

                return loadedState;

            } else if (data.status === 'empty') {
                return null;
            } else {
                throw new Error(data.message || "Unknown error loading sheet");
            }

        } catch (error) {
            console.error("Network error loading sheet:", error);
            throw error;
        }
    },

    // Save data to Google Sheet
    async save(scriptUrl: string, state: AlmacenState): Promise<void> {
        try {
            const inventoryRows: any[] = [];

            // Sort keys just for deterministic order
            const keys = Object.keys(state.ubicaciones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            keys.forEach(id => {
                const u = state.ubicaciones[id];
                if (u.tipo === 'muro' || u.tipo === 'puerta' || u.tipo === 'zona_carga') return;

                // 1. SHELVES
                if (u.tipo === 'estanteria_modulo') {
                    if (u.shelfItems) {
                        Object.entries(u.shelfItems as any).forEach(([subKey, items]: [string, any]) => {
                            // subKey is "M1-A1" -> RowID is "E1-M1-A1"
                            const rowId = u.id + '-' + subKey;

                            items.forEach((item: any) => {
                                inventoryRows.push({
                                    id: rowId,
                                    tipo: item.tipo,
                                    contenido: item.contenido,
                                    cantidad: item.cantidad,
                                    programa: item.programa
                                });
                            });
                        });
                    }
                }
                // 2. PALLETS
                else {
                    if (u.items && u.items.length > 0) {
                        u.items.forEach((item: any) => {
                            inventoryRows.push({
                                id: u.id,
                                tipo: item.tipo,
                                contenido: item.contenido,
                                cantidad: item.cantidad,
                                programa: item.programa
                            });
                        });
                    }
                }
            });

            const payload = {
                configJson: JSON.stringify(state),
                inventoryRows: inventoryRows
            };

            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.status !== 'success') {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error("Error saving to sheet:", error);
            throw error;
        }
    }
};
