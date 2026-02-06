import { config } from '../config';
const API_BASE_URL = config.API_BASE_URL;
import type { Ubicacion, Caja, MaterialEnCaja } from '../types';

export interface RawShelfItem {
    ID_UBICACION: string; // "E1-M1-A1"
    MATERIAL: string;     // "Caja de 5 extintores"
    CANTIDAD: number | string; // 1 or "1"
    LOTE: string;         // "Andalucía" (acts as Program)
    ESTADO: string;       // "estanteria_modulo" (acts as Type)
    RESPONSABLE?: string;
    TIPO_DE_CONTENEDOR?: string; // Kept for reference
    [key: string]: any; // Allow accessing properties with spaces like "TIPO DE CONTENEDOR"
}

export const InventoryService = {
    async fetchInventory(): Promise<RawShelfItem[]> {
        try {
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            let response;

            // CHECK IF GOOGLE SCRIPT IS CONFIGURED
            const useGoogleScript = config.GOOGLE_SCRIPT_URL && !config.GOOGLE_SCRIPT_URL.includes('XXXXXXXX');

            if (useGoogleScript) {
                console.log("Fetching from Google Apps Script...");
                response = await fetch(config.GOOGLE_SCRIPT_URL);
            } else {
                response = await fetch(`${API_BASE_URL}/api/v1/inventory/`, { headers });
            }

            if (!response.ok) {
                console.warn('Failed to fetch inventory, falling back to empty/local', response.status);
                return [];
            }

            const json = await response.json();

            // Handle Google Script Wrapper ({ inventoryRows: [] }) vs Backend Direct Array ([])
            let data = Array.isArray(json) ? json : (json.inventoryRows || []);

            console.log("Inventario cargado:", data); // DEBUG
            return data;
        } catch (error) {
            console.error('InventoryService: Error fetching inventory:', error);
            return [];
        }
    },

    parseInventoryToState(data: RawShelfItem[]): Record<string, Partial<Ubicacion>> {
        const shelves: Record<string, Record<string, RawShelfItem[]>> = {};
        const pallets: Record<string, RawShelfItem[]> = {};

        data.forEach(item => {
            if (!item.ID_UBICACION) return;

            const locationId = String(item.ID_UBICACION).trim();
            const parts = locationId.split('-');

            // CASE 1: SHELF (Format: E1-M1-A1)
            // Regex check could be safer, but splitting by '-' length >= 3 covers E*-M*-A*
            // We specifically look for IDs starting with 'E' to distinguish from other potential formats
            if (parts.length >= 3 && locationId.toUpperCase().startsWith('E')) {
                const shelfId = parts[0]; // "E1"
                const slotId = `${parts[1]}-${parts[2]}`; // "M1-A1"

                if (!shelves[shelfId]) shelves[shelfId] = {};
                if (!shelves[shelfId][slotId]) shelves[shelfId][slotId] = [];
                shelves[shelfId][slotId].push(item);
            }
            // CASE 2: PALLET / FLOOR (Format: Numeric "1", "2"...)
            // We treat anything else as a direct location ID mapping
            else {
                // If it's a simple number like "1", matches our floor pallets
                if (!pallets[locationId]) pallets[locationId] = [];
                pallets[locationId].push(item);
            }
        });

        const updates: Record<string, Partial<Ubicacion>> = {};

        // 1. Process Shelves
        Object.entries(shelves).forEach(([shelfId, slots]) => {
            // ... (keep existing shelf logic for 'cajasEstanteria')
            const cajasEstanteria: Record<string, Caja> = {};

            Object.entries(slots).forEach(([slotId, items]) => {
                const programs = items.map(i => i.LOTE);
                const mainProgram = programs[0] || 'Vacio';

                const contentList: MaterialEnCaja[] = items.map(item => ({
                    id: crypto.randomUUID(),
                    materialId: 'mat-gen',
                    nombre: item.MATERIAL,
                    cantidad: Number(item.CANTIDAD) || 1,
                    estado: 'operativo',
                    programa: item.LOTE // Map LOTE to granular program
                }));

                const tipoContenedorRaw = items[0].TIPO_DE_CONTENEDOR;
                // Default to 'Caja' if empty or not 'Suelto'
                const tipoContenedor: 'Caja' | 'Suelto' = (tipoContenedorRaw && tipoContenedorRaw.trim().toLowerCase() === 'suelto') ? 'Suelto' : 'Caja';

                cajasEstanteria[slotId] = {
                    id: `SLOT-${shelfId}-${slotId}`,
                    descripcion: 'Contenido',
                    programa: mainProgram,
                    cantidad: 1,
                    contenido: contentList,
                    tipoContenedor: tipoContenedor
                };
            });

            updates[shelfId] = { cajasEstanteria };
        });

        // 2. Process Pallets
        Object.entries(pallets).forEach(([id, items]) => {
            // For pallets, we update 'programa' and 'contenido'
            // If multiple items, we might concatenate description?

            // Dominant Program
            const programs = items.map(i => i.LOTE).filter(Boolean);
            const mainProgram = programs.length > 0 ? programs[0] : 'Vacio';

            // If multiple materials, join them? (UNUSED NOW)
            // const materials = items.map(i => `${i.CANTIDAD}x ${i.MATERIAL}`);
            // const contentText = materials.join(', ');

            // NEW LOGIC: Check for Loose Items (Suelto)
            const isSuelto = items.some(i => i.TIPO_DE_CONTENEDOR?.toLowerCase() === 'suelto');
            let materiales: MaterialEnCaja[] | undefined = undefined;
            let cajas: Caja[] | undefined = undefined;

            if (isSuelto) {
                materiales = items.map(item => ({
                    id: crypto.randomUUID(),
                    materialId: 'mat-gen',
                    nombre: item.MATERIAL,
                    cantidad: Number(item.CANTIDAD) || 1,
                    estado: 'operativo',
                    programa: item.LOTE
                }));
            } else {
                // BOX LOGIC: Generate structural Boxes to enable "Vertical Stripes"
                cajas = items.map(item => ({
                    id: crypto.randomUUID(),
                    descripcion: item.MATERIAL,
                    programa: item.LOTE, // CRITICAL: This drives the multi-color stripes
                    cantidad: Number(item.CANTIDAD) || 1,
                    contenido: [] // Empty contents for now
                }));
            }

            // MERGE with existing update (Critical for Shelves that also have generic items)
            updates[id] = {
                ...(updates[id] || {}),
                programa: mainProgram,
                // contenido: contentText... // REMOVED: Do not overwrite label with inventory text
                materiales: materiales,
                cajas: cajas
            };
        });

        return updates;
    }
};
