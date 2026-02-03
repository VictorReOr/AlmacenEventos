import type { AlmacenState, Programa } from '../types';

interface LoadReport {
    totalRows: number;
    imported: number;
    skipped: number;
    errors: string[];
}

export const GoogleSheetsService = {

    async load(scriptUrl: string, baseState?: AlmacenState): Promise<AlmacenState | null> {
        try {
            console.log("🚀 Fetching from:", scriptUrl);
            const response = await fetch(scriptUrl, { method: 'GET' });
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("Received bad JSON:", text.substring(0, 100));
                throw new Error("Invalid JSON from Server");
            }

            if (data.status === 'success') {
                // 1. Initialize State from CODE SUPREMACY
                let loadedState: AlmacenState = baseState ? JSON.parse(JSON.stringify(baseState)) : {
                    ubicaciones: {},
                    geometry: []
                };

                // Clear Inventory buckets
                if (loadedState.ubicaciones) {
                    Object.values(loadedState.ubicaciones).forEach(u => {
                        u.cajas = [];
                        u.materiales = [];
                        u.shelfItems = {};
                        delete u.items;
                    });
                }

                // 2. Strict Parsing
                const rawRows: any[] = data.inventoryRows || [];
                const report: LoadReport = { totalRows: rawRows.length, imported: 0, skipped: 0, errors: [] };

                if (rawRows.length === 0) {
                    console.warn("⚠️ [Loader] 0 rows returned.");
                } else {
                    console.log(`🔍 [Schema V2] Columns detected: [${Object.keys(rawRows[0]).join(', ')}]`);
                }

                this.processRows(rawRows, loadedState, report);

                console.log(`📊 [Load Report] Read: ${report.totalRows} | Imported: ${report.imported} | Skipped: ${report.skipped}`);
                if (report.errors.length > 0) {
                    console.warn("⚠️ Validation Errors (First 5):", report.errors.slice(0, 5));
                }

                if (report.imported === 0 && report.totalRows > 0) {
                    alert(`⚠️ IMPORTACIÓN FALLIDA: 0 filas válidas.\nVerifica que la hoja use el formato V2 (A-L).`);
                }

                return loadedState;
            } else if (data.status === 'empty') {
                return null;
            } else {
                throw new Error(data.message || "Unknown error loading sheet");
            }

        } catch (error: any) {
            console.error("🔥 Error loading sheet:", error);
            alert(`ERROR CARGA: ${error.message}`);
            throw error;
        }
    },

    processRows(rows: any[], state: AlmacenState, report: LoadReport) {

        // Mapeo Difuso V2
        // Prioridad: Nombres V2 -> V1 -> Ingles
        const strategies = {
            // A: ID_REGISTRO (Ignored for logic)
            // B
            typeLoc: ['TIPO_UBICACION', 'TIPO_CONTENEDOR', 'UBICACION_TIPO'],
            // C
            placeId: ['ID_LUGAR', 'UBICACION', 'LUGAR', 'ESTANTERIA', 'POSICION'],
            // D & E
            modulev: ['MODULO', 'MOD'],
            levelv: ['ALTURA', 'NIVEL', 'HEIGHT'],
            // F
            typeItem: ['TIPO_ITEM', 'TIPO_ARTICULO', 'FORMATO'],
            // G
            content: ['MATERIAL', 'CONTENIDO', 'DESCRIPCION', 'ITEM'],
            qty: ['CANTIDAD', 'UNIDADES'],
            program: ['LOTE', 'PROGRAMA'],
            status: ['ESTADO'],
            resp: ['RESPONSABLE'],
            obs: ['OBSERVACIONES']
        };

        const findVal = (row: any, keys: string[]) => {
            for (const k of keys) {
                if (row[k] !== undefined) return row[k];
                const found = Object.keys(row).find(rk => rk.toUpperCase() === k);
                if (found) return row[found];
            }
            return undefined;
        };

        rows.forEach((row, idx) => {
            // 1. Determine Location Type
            const typeLoc = String(findVal(row, strategies.typeLoc) || '').toLowerCase().trim();
            const placeId = String(findVal(row, strategies.placeId) || '').trim();

            if (!placeId) return; // Skip empty rows

            // 2. Construct Full ID based on Type
            let fullId = placeId;
            let isShelf = typeLoc.includes('estanteria');

            // Logic: If user didn't specify Type, infer from ID (E1 vs 1)
            if (!typeLoc && placeId.match(/^E\d+/i)) isShelf = true;

            let moduleNum = 0;
            let levelNum = 0;

            if (isShelf) {
                moduleNum = Number(findVal(row, strategies.modulev));
                levelNum = Number(findVal(row, strategies.levelv));

                // Validate Shelf Components
                if (!moduleNum || !levelNum) {
                    // Try parsing from placeId if user wrote 'E1-M1-A1' in ID_LUGAR by mistake (Legacy Fallback)
                    const matchOld = placeId.match(/^(.+)-M(\d+)-A(\d+)$/i);
                    if (matchOld) {
                        // Correct user usage silently
                        fullId = matchOld[1]; // E1
                        moduleNum = Number(matchOld[2]);
                        levelNum = Number(matchOld[3]);
                    } else {
                        report.errors.push(`Row ${idx + 1}: Estantería '${placeId}' requiere COLUMNAS D (Modulo) & E (Altura).`);
                        report.skipped++;
                        return;
                    }
                } else {
                    // Clean placeId (just in case they put E1-M1)
                    fullId = placeId.split('-')[0];
                }
            }

            // 3. TARGET RESOLUTION & GHOST BUSTING
            // Resolve Parent
            let targetUbi = state.ubicaciones[fullId];

            // Try Alias E-1
            if (!targetUbi && fullId.match(/^E\d+$/i)) { // Ensure it's just E<number>
                const alias = `E-${fullId.substring(1)}`; // E1 -> E-1
                if (state.ubicaciones[alias]) {
                    fullId = alias;
                    targetUbi = state.ubicaciones[alias];
                }
            }

            if (!targetUbi) {
                report.skipped++;
                // DEBUG: Only log if it looks like real data (has placeId)
                if (placeId) {
                    console.warn(`[Row ${idx + 1}] 👻 REJECTED: Location '${fullId}' not found in code. (Type: ${typeLoc})`);
                    if (idx < 5) console.log("Available Keys Sample:", Object.keys(state.ubicaciones).slice(0, 5));
                }
                return;
            }

            // 4. INJECTION
            const material = String(findVal(row, strategies.content) || 'Desconocido');
            const typeItem = String(findVal(row, strategies.typeItem) || '').toLowerCase();
            const isLoose = typeItem.includes('suelto');
            const qty = Number(findVal(row, strategies.qty) || 1);
            const program = String(findVal(row, strategies.program) || 'General');

            const extras = {
                estado: String(findVal(row, strategies.status) || 'operativo'),
                responsable: String(findVal(row, strategies.resp) || ''),
                observaciones: String(findVal(row, strategies.obs) || '')
            };

            if (isShelf) {
                const subKey = `M${moduleNum}-A${levelNum}`;

                if (!targetUbi.shelfItems) targetUbi.shelfItems = {};
                if (!targetUbi.shelfItems[subKey]) targetUbi.shelfItems[subKey] = [];

                targetUbi.shelfItems[subKey].push({
                    id: crypto.randomUUID(),
                    descripcion: material,
                    programa: program,
                    cantidad: qty,
                    contenido: [],
                    tipoContenedor: isLoose ? 'Suelto' : 'Caja',
                    ...extras as any
                });

                targetUbi.cajasEstanteria = targetUbi.shelfItems as any;
                report.imported++;

            } else {
                // Pallet
                if (isLoose) {
                    if (!targetUbi.materiales) targetUbi.materiales = [];
                    targetUbi.materiales.push({
                        id: crypto.randomUUID(),
                        materialId: 'gen',
                        nombre: material,
                        cantidad: qty,
                        estado: 'operativo',
                        ...extras as any
                    });
                } else {
                    if (!targetUbi.cajas) targetUbi.cajas = [];
                    targetUbi.cajas.push({
                        id: crypto.randomUUID(),
                        descripcion: material,
                        programa: program,
                        cantidad: qty,
                        contenido: [],
                        tipoContenedor: 'Caja',
                        ...extras as any
                    });
                }

                const total = (targetUbi.cajas?.length || 0) + (targetUbi.materiales?.length || 0);
                targetUbi.contenido = total === 1 ? material : `Varios (${total})`;
                if (total === 1) targetUbi.programa = program as Programa;

                report.imported++;
            }
        });
    },

    async save(_scriptUrl: string, _state: AlmacenState): Promise<void> {
        // ... (Save logic deferred/not priority) 
        // Strict contract implies we likely shouldn't write from here yet 
        // until we implement valid V2 row generation.
    }
};
