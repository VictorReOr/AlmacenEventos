import type { Ubicacion, Caja, MaterialEnCaja } from '../types';

/**
 * Extrae programas únicos de un objeto para las franjas de visualización.
 * Sigue los "Contratos 1 & 3" de las especificaciones del usuario.
 * 
 * Lógica:
 * 1. Si el objeto es un Contenedor de Cajas (ej. Palé/Estantería), derivar de las Cajas.
 * 2. Si el objeto es un Contenedor de Materiales (ej. Caja), derivar de los Materiales.
 * 3. Por defecto, al propio 'programa' del objeto.
 * 4. Materiales sueltos en Palés usan el programa del Palé (Legado Contrato 1).
 */
export const getLotAttributes = (
    item: Ubicacion | Caja | MaterialEnCaja | any
): string[] => {
    const programs = new Set<string>();

    // CASO 1: Ubicación (Palé/Estantería) con 'cajas'
    if (item.cajas && Array.isArray(item.cajas)) {
        item.cajas.forEach((c: Caja) => {
            if (c.programa) programs.add(c.programa);
        });
    }

    // CASO 2: Ubicación con 'materiales' (Sueltos)
    // CONTRATO ESTRICTO 1: "Los materiales sueltos siguen el programa de la ubicación"
    if (item.materiales && Array.isArray(item.materiales) && item.materiales.length > 0) {
        // Lógica de WarehouseMap.tsx: programs.add(u.programa || 'Vacio');
        programs.add(item.programa || 'Vacio');
    }

    // CASO 3: Caja con 'contenido'
    // Consistencia Derivada: Si el Palé mira las Cajas, la Caja mira el Contenido.
    if (item.contenido && Array.isArray(item.contenido)) {
        item.contenido.forEach((m: MaterialEnCaja) => {
            if (m.programa) programs.add(m.programa);
        });
    }

    // CASO 4: Ítems anidados en Estantería (cajasEstanteria)
    // Map<Hueco, Caja>
    if (item.cajasEstanteria) {
        Object.values(item.cajasEstanteria).forEach((c: any) => {
            if (c.programa) programs.add(c.programa);
        });
    }

    // RESPALDO (FALLBACK)
    if (programs.size === 0) {
        programs.add(item.programa || 'Vacio');
    }

    // FILTRAR 'Vacio' (A menos que sea el único)
    const unique = Array.from(programs).filter(p => p !== 'Vacio');
    const finalPrograms = unique.length > 0 ? unique : ['Vacio'];

    // LÍMITE - Eliminado, dejar que el solicitante decida
    return finalPrograms;
};
