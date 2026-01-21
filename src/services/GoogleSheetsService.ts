import type { AlmacenState, Ubicacion } from '../types';

interface SheetResponse {
    status: 'success' | 'error' | 'empty';
    ubicaciones?: Record<string, Ubicacion>;
    geometry?: { x: number; y: number }[];
    message?: string;
}

export const GoogleSheetsService = {

    // Load data from Google Sheet
    async load(scriptUrl: string): Promise<AlmacenState | null> {
        try {
            const response = await fetch(scriptUrl, {
                method: 'GET',
            });

            const data: any = await response.json();

            if (data.status === 'success') {
                // 1. Get Technical State (Geometry + Objects Position) from Config
                // The Apps Script now returns { geometry: [], fullState: {} (optional), inventory: [] }
                // We need to parse the "fullState" if available to get positions.

                let loadedState: AlmacenState = {
                    ubicaciones: {},
                    geometry: data.geometry || []
                };

                // Try to load the technical state (positions)
                if (data.configJson) {
                    try {
                        const parsedConfig = JSON.parse(data.configJson);
                        loadedState = { ...loadedState, ...parsedConfig };
                    } catch (e) {
                        console.error("Error parsing Config JSON", e);
                    }
                }

                // 2. Apply Inventory Data (Business Data)
                // The inventory comes as a list of rows properties
                const inventory = data.inventory || {};
                // Inventory is Record<id, {contenido, programa, ...}>

                Object.entries(inventory).forEach(([rowId, rowData]: [string, any]) => {
                    // Check if it's a Shelf Sub-Level (E1-M1-A1)
                    const shelfMatch = rowId.match(/^(.+)-M(\d+)-A(\d+)$/);

                    if (shelfMatch) {
                        // It's a Shelf Level!
                        const parentId = shelfMatch[1]; // E1
                        const modIdx = shelfMatch[2];   // 1
                        const levelIdx = shelfMatch[3]; // 1
                        const key = `M${modIdx}-A${levelIdx}`;

                        if (loadedState.ubicaciones[parentId]) {
                            const parent = loadedState.ubicaciones[parentId];
                            if (!parent.shelfContents) parent.shelfContents = {};

                            parent.shelfContents[key] = rowData.contenido || "";
                            // Ideally we could store program per level too, but for now just content
                        }
                    } else {
                        // It's a normal object (Pallet)
                        if (loadedState.ubicaciones[rowId]) {
                            loadedState.ubicaciones[rowId].contenido = rowData.contenido;
                            loadedState.ubicaciones[rowId].programa = rowData.programa;
                        }
                    }
                });

                return loadedState;

            } else if (data.status === 'empty') {
                console.log("Sheet is empty.");
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
            // Prepared Logic:
            // 1. Payload.configJson = JSON.stringify(state) -> Saves everything to Config tab (Backup/Technical)
            // 2. Payload.inventoryRows = [] -> Generated List for user

            const inventoryRows: any[] = [];

            // Sort keys for nicer sheet order
            const keys = Object.keys(state.ubicaciones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            keys.forEach(id => {
                const u = state.ubicaciones[id];

                // SKIPS
                if (u.tipo === 'muro' || u.tipo === 'puerta' || u.tipo === 'zona_carga') return;

                if (u.tipo === 'estanteria_modulo') {
                    // EXPAND SHELF
                    // Calculate Modules: Width / 1.0 (approx)
                    const modules = Math.max(1, Math.round(u.width / 1.0));

                    for (let m = 1; m <= modules; m++) {
                        for (let a = 1; a <= 4; a++) {
                            const subId = `${u.id}-M${m}-A${a}`;
                            const contentKey = `M${m}-A${a}`;
                            const val = u.shelfContents?.[contentKey] || "";

                            inventoryRows.push({
                                id: subId,
                                contenido: val,
                                programa: u.programa, // Inherit program from parent? Or just leave empty
                                tipo: 'Estanteria Nivel'
                            });
                        }
                    }
                } else {
                    // PALLET (Standard)
                    inventoryRows.push({
                        id: u.id,
                        contenido: u.contenido || "",
                        programa: u.programa,
                        tipo: 'Palet'
                    });
                }
            });

            const payload = {
                configJson: JSON.stringify(state), // Full Technical State
                inventoryRows: inventoryRows       // Clean Business List
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
