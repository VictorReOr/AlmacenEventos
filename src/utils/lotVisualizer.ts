import type { Ubicacion, Caja, MaterialEnCaja } from '../types';

/**
 * extracts unique programs from an object for visualization stripes.
 * Follows "Contract 1 & 3" from user specs.
 * 
 * Logic:
 * 1. If object is a Container of Boxes (e.g. Pallet/Shelf), derive from Boxes.
 * 2. If object is a Container of Materials (e.g. Box), derive from Materials.
 * 3. Default to object's own 'programa'.
 * 4. Loose materials on Pallets use Pallet's program (Legacy Contract 1).
 */
export const getLotAttributes = (
    item: Ubicacion | Caja | MaterialEnCaja | any
): string[] => {
    const programs = new Set<string>();

    // CASE 1: Location (Pallet/Shelf) with 'cajas'
    if (item.cajas && Array.isArray(item.cajas)) {
        item.cajas.forEach((c: Caja) => {
            if (c.programa) programs.add(c.programa);
        });
    }

    // CASE 2: Location with 'materiales' (Loose)
    // STRICT CONTRACT 1: "Loose materials follow location program"
    if (item.materiales && Array.isArray(item.materiales) && item.materiales.length > 0) {
        // WarehouseMap.tsx logic: programs.add(u.programa || 'Vacio');
        programs.add(item.programa || 'Vacio');
    }

    // CASE 3: Box (Caja) with 'contenido'
    // Derived Consistency: If Pallet looks at Boxes, Box looks at Contents.
    if (item.contenido && Array.isArray(item.contenido)) {
        item.contenido.forEach((m: MaterialEnCaja) => {
            if (m.programa) programs.add(m.programa);
        });
    }

    // CASE 4: Nested Shelf Items (cajasEstanteria)
    // Map<Slot, Caja>
    if (item.cajasEstanteria) {
        Object.values(item.cajasEstanteria).forEach((c: any) => {
            if (c.programa) programs.add(c.programa);
        });
    }

    // FALLBACK
    if (programs.size === 0) {
        programs.add(item.programa || 'Vacio');
    }

    // FILTER 'Vacio' (Unless it's the only one)
    const unique = Array.from(programs).filter(p => p !== 'Vacio');
    const finalPrograms = unique.length > 0 ? unique : ['Vacio'];

    // LIMIT - Removed, let caller decide
    return finalPrograms;
};
