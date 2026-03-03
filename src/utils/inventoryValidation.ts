import type { Ubicacion } from '../types';
import { SHELF_MODULE_WIDTH } from '../data';

export interface InventoryError {
    shelfId: string;
    description: string;
    details: string; // "Ítem 'X' asignado a Módulo 8 (Máx 6)"
    reason: 'out_of_bounds' | 'invalid_format' | 'other';
}

export const validateInventory = (ubicaciones: Record<string, Ubicacion>): InventoryError[] => {
    const errors: InventoryError[] = [];

    Object.values(ubicaciones).forEach(u => {
        if (u.tipo === 'estanteria_modulo' && u.cajasEstanteria) {

            // Calcular Módulos Máximos
            // Ej. Ancho 6 / ModuleWidth 1 = 6 Módulos
            const maxModules = Math.round(u.width / SHELF_MODULE_WIDTH);

            Object.entries(u.cajasEstanteria).forEach(([slotKey, box]) => {
                // formato de slotKey: "M{num}-A{num}"
                const match = slotKey.match(/M(\d+)-A(\d+)/i);

                if (match) {
                    const moduleNum = parseInt(match[1]);
                    const levelNum = parseInt(match[2]);

                    // Comprobar Límites del Módulo
                    if (moduleNum > maxModules) {
                        errors.push({
                            shelfId: u.id,
                            description: `Error en ${u.id} (${u.mensaje || u.contenido})`,
                            details: `El ítem '${box.descripcion || 'Desconocido'}' está asignado al Módulo ${moduleNum}, pero esta estantería solo tiene ${maxModules} módulos.`,
                            reason: 'out_of_bounds'
                        });
                    }

                    // Comprobar Límites del Nivel (Límite Suave coincidiendo con el Renderizador)
                    // El Renderizador ignora > 5. Así que > 5 es un error.
                    if (levelNum > 5) {
                        errors.push({
                            shelfId: u.id,
                            description: `Error de Altura en ${u.id}`,
                            details: `El ítem está asignado a la Altura ${levelNum}, pero el máximo visible es 5.`,
                            reason: 'out_of_bounds'
                        });
                    }

                } else {
                    // Formato de Clave de Slot Inválida (si estrictamente se usa M-A)
                    // Podríamos ignorar esto si existen datos de legado.
                }
            });
        }
    });

    return errors;
};
