
import { generateInitialState } from '../data';
import type { AlmacenState, Ubicacion } from '../types';

export const sanitizeState = (state: AlmacenState): AlmacenState => {
    console.log("🛡️ Strict Rehydration: Enforcing Code Supremacy...");

    // 1. Get Canonical Structures (Code Supremacy)
    // The 'data.ts' file is the ONLY source of truth for IDs and Geometry.
    const pristineState = generateInitialState();
    const cleanUbicaciones: Record<string, Ubicacion> = {};
    let rehydratedCount = 0;
    let ghostsRemoved = 0;

    // Initialize with ALL Pristine Structures (Shelves AND Pallets)
    // This ensures we start with the correct X, Y, W, H, Rotation from code.
    Object.values(pristineState.ubicaciones).forEach(u => {
        cleanUbicaciones[u.id] = { ...u };
    });

    // 2. Process Input State (Cloud/Local) to Hydrate Inventory ONLY
    Object.values(state.ubicaciones).forEach(u => {
        // If the ID exists in our Pristine Map, it's valid.
        if (cleanUbicaciones[u.id]) {
            const target = cleanUbicaciones[u.id];

            // Hydrate Inventory Fields from Storage
            // We CONSCIOUSLY IGNORE 'x', 'y', 'rotation' from storage to force a layout reset.
            // This is necessary to clear "ghost" positions.
            if (u.cajas) target.cajas = u.cajas;
            if (u.materiales) target.materiales = u.materiales;
            if (u.items) target.items = u.items;
            if (u.shelfItems) target.shelfItems = u.shelfItems;

            // Handle potentially untyped legacy properties
            const uAny = u as any;
            const targetAny = target as any;
            if (uAny.cajasEstanteria) targetAny.cajasEstanteria = uAny.cajasEstanteria;
            if (uAny.niveles) targetAny.niveles = uAny.niveles;

            // Programs/Content updates
            if (u.programa) target.programa = u.programa;
            if (u.contenido) target.contenido = u.contenido;

            rehydratedCount++;
        } else {
            // Structure in Cloud but NOT in Code = GHOST.
            // This catches legacy pallets (e.g. "67") and unknown objects.
            console.warn(`👻 Ghost Structure Busting: Discarded ${u.id} (${u.tipo})`);
            ghostsRemoved++;
        }
    });

    // 3. (Optional) Validation
    // Since we forced 'data.ts' geometry, we trust it is collision-free.

    console.log(`✅ Sanitize Complete. Hydrated: ${rehydratedCount}, Ghosts Busted: ${ghostsRemoved}`);

    return {
        ubicaciones: cleanUbicaciones,
        geometry: pristineState.geometry
    };
};
