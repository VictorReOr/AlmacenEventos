import type { AlmacenState } from '../types';

export const GoogleSheetsService = {

    // Load data from Google Sheet
    async load(scriptUrl: string): Promise<AlmacenState | null> {
        try {
            const response = await fetch(scriptUrl, { method: 'GET' });
            const data: any = await response.json();

            if (data.status === 'success') {
                // 1. Base State (Geometry + Positions)
                let loadedState: AlmacenState = {
                    ubicaciones: {},
                    geometry: data.geometry || []
                };

                if (data.configJson) {
                    try {
                        const parsedConfig = JSON.parse(data.configJson);
                        loadedState = { ...loadedState, ...parsedConfig };
                    } catch (e) {
                        console.error("Error parsing Config JSON", e);
                    }
                }

                // 2. Apply Relational Inventory
                // data.inventoryRows is now an Array of { id, tipo, contenido, cantidad, programa }
                const rows = data.inventoryRows || [];

                // Reset items to empty arrays first (to avoid stale data if re-loading)
                Object.values(loadedState.ubicaciones).forEach(u => {
                    u.items = [];
                    u.shelfItems = {};
                    // Clear legacy
                    u.contenido = "";
                });

                rows.forEach((row: any) => {
                    const rowId = row.id;
                    const item: any = {
                        id: crypto.randomUUID(), // Local unique ID for React keys
                        tipo: row.tipo,
                        contenido: row.contenido,
                        cantidad: row.cantidad,
                        programa: row.programa
                    };

                    // Check for Shelf Sub-Location (E1-M1-A1)
                    const shelfMatch = rowId.match(/^(.+)-M(\d+)-A(\d+)$/);

                    if (shelfMatch) {
                        const parentId = shelfMatch[1];
                        const subKey = `M${shelfMatch[2]}-A${shelfMatch[3]}`; // M1-A1

                        if (loadedState.ubicaciones[parentId]) {
                            const parent = loadedState.ubicaciones[parentId];
                            if (!parent.shelfItems) parent.shelfItems = {};
                            if (!parent.shelfItems[subKey]) parent.shelfItems[subKey] = [];

                            parent.shelfItems[subKey].push(item);
                        }
                    } else {
                        // Standard Pallet
                        if (loadedState.ubicaciones[rowId]) {
                            const u = loadedState.ubicaciones[rowId];
                            if (!u.items) u.items = [];
                            u.items.push(item);

                            // Legacy sync for visual compatibility (optional)
                            if (!u.contenido) u.contenido = item.contenido;
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
                        Object.entries(u.shelfItems).forEach(([subKey, items]) => {
                            // subKey is "M1-A1" -> RowID is "E1-M1-A1"
                            const rowId = `${u.id}-${subKey}`;

                            items.forEach(item => {
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
                        u.items.forEach(item => {
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
