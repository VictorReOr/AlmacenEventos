import type { Ubicacion } from '../types';
import { SHELF_MODULE_WIDTH } from '../data';

export interface InventoryError {
    shelfId: string;
    description: string;
    details: string; // "Item 'X' asignado a Módulo 8 (Máx 6)"
    reason: 'out_of_bounds' | 'invalid_format' | 'other';
}

export const validateInventory = (ubicaciones: Record<string, Ubicacion>): InventoryError[] => {
    const errors: InventoryError[] = [];

    Object.values(ubicaciones).forEach(u => {
        if (u.tipo === 'estanteria_modulo' && u.cajasEstanteria) {

            // Calculate Max Modules
            // E.g. Width 6 / ModuleWidth 1 = 6 Modules
            const maxModules = Math.round(u.width / SHELF_MODULE_WIDTH);

            Object.entries(u.cajasEstanteria).forEach(([slotKey, box]) => {
                // slotKey format: "M{num}-A{num}"
                const match = slotKey.match(/M(\d+)-A(\d+)/i);

                if (match) {
                    const moduleNum = parseInt(match[1]);
                    const levelNum = parseInt(match[2]);

                    // Check Module Bounds
                    if (moduleNum > maxModules) {
                        errors.push({
                            shelfId: u.id,
                            description: `Error en ${u.id} (${u.mensaje || u.contenido})`,
                            details: `El ítem '${box.descripcion || 'Desconocido'}' está asignado al Módulo ${moduleNum}, pero esta estantería solo tiene ${maxModules} módulos.`,
                            reason: 'out_of_bounds'
                        });
                    }

                    // Check Level Bounds (Soft Limit matching Renderer)
                    // Renderer ignores > 5. So > 5 is an error.
                    if (levelNum > 5) {
                        errors.push({
                            shelfId: u.id,
                            description: `Error de Altura en ${u.id}`,
                            details: `El ítem está asignado a la Altura ${levelNum}, pero el máximo visible es 5.`,
                            reason: 'out_of_bounds'
                        });
                    }

                } else {
                    // Invalid Slot Key Format (if strictly using M-A)
                    // We might ignore this if legacy data exists.
                }
            });
        }
    });

    return errors;
};
