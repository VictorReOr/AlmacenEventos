import type { Ubicacion, Caja, MaterialEnCaja } from './types';
import { RAW_SHELF_DATA } from './data/rawShelfData';
import type { RawShelfItem } from './data/rawShelfData';

// Helper to create a Box wrapper for a Pallet
// const createPalletBox = ... (removed unused)

// --- NEW PARSER FOR SHELVES ---
const parseShelfInventory = (data: RawShelfItem[]): Record<string, Partial<Ubicacion>> => {
    const shelves: Record<string, Record<string, RawShelfItem[]>> = {};

    // 1. Group by Shelf -> Slot
    data.forEach(item => {
        const parts = item.location.split('-'); // E1-M1-A1
        const shelfId = parts[0]; // E1
        const slotId = `${parts[1]}-${parts[2]}`; // M1-A1

        if (!shelves[shelfId]) shelves[shelfId] = {};
        if (!shelves[shelfId][slotId]) shelves[shelfId][slotId] = [];

        shelves[shelfId][slotId].push(item);
    });

    const updates: Record<string, Partial<Ubicacion>> = {};

    // 2. Create Ubicacion updates
    Object.entries(shelves).forEach(([shelfId, slots]) => {
        const cajasEstanteria: Record<string, Caja> = {};

        Object.entries(slots).forEach(([slotId, items]) => {
            // Determine dominant program
            const programs = items.map(i => i.program);
            const mainProgram = programs[0] || 'Vacio';

            // Create Content List
            const contentList: MaterialEnCaja[] = items.map(item => ({
                id: crypto.randomUUID(),
                materialId: 'mat-gen',
                nombre: item.description,
                cantidad: item.quantity,
                estado: 'operativo'
            }));

            // Create the Slot Container
            cajasEstanteria[slotId] = {
                id: `SLOT-${shelfId}-${slotId}`,
                descripcion: 'Contenido', // Generic label, UI likely iterates content
                programa: mainProgram,
                cantidad: 1,
                contenido: contentList
            };
        });

        updates[shelfId] = {
            cajasEstanteria
        };
    });

    return updates;
};

// Generate Shelf Data (Will be empty if RAW_SHELF_DATA is empty)
const shelfUpdates = parseShelfInventory(RAW_SHELF_DATA);

// --- MERGE WITH PALLET DATA ---

// CLEARED: Testing data removed causing map to rely purely on live data.
const PALLET_DATA: Record<string, Partial<Ubicacion>> = {};

export const INITIAL_INVENTORY_UPDATES: Record<string, Partial<Ubicacion>> = {
    ...PALLET_DATA,
    ...shelfUpdates
};
