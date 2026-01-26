import type { Ubicacion, Caja } from '../types';

interface Entity {
    text: string;
    label: string;
}

export const AssistantActionHandler = {
    async executeAction(
        intent: string,
        entities: Entity[],
        currentMap: Record<string, Ubicacion>
    ): Promise<{ updates: Ubicacion[], message: string }> {

        // Helper: Find Location by fuzzy ID match
        const findLocation = (query: string): Ubicacion | undefined => {
            const cleanQuery = query.toUpperCase().trim();
            // Direct Match
            if (currentMap[cleanQuery]) return currentMap[cleanQuery];
            // Partial Match (dangerous but needed for "Palet 1")
            const idMatch = Object.keys(currentMap).find(id =>
                id.toUpperCase() === cleanQuery ||
                id.toUpperCase().replace('-', '') === cleanQuery.replace('-', '')
            );
            return idMatch ? currentMap[idMatch] : undefined;
        };

        const sourceEnt = entities.find(e => e.label === 'SOURCE_LOC' || e.label === 'LOC');
        const destEnt = entities.find(e => e.label === 'DEST_LOC');
        const itemEnt = entities.find(e => e.label === 'MATERIAL' || e.label === 'ITEM');
        const qtyEnt = entities.find(e => e.label === 'QUANTITY');

        console.log("Executing Action:", { intent, source: sourceEnt?.text, dest: destEnt?.text });

        // --- INTENT: MOVE ---
        if (intent === 'MOVE') {
            if (!sourceEnt || !destEnt) {
                throw new Error("Para mover necesito Origen y Destino.");
            }

            const source = findLocation(sourceEnt.text);
            const dest = findLocation(destEnt.text);

            if (!source) throw new Error(`No encuentro el origen "${sourceEnt.text}".`);
            if (!dest) throw new Error(`No encuentro el destino "${destEnt.text}".`);

            // Validate Move
            if (dest.programa !== 'Vacio' && dest.cajas && dest.cajas.length > 0) {
                // For now, simple blocker. Later could merge.
                throw new Error(`El destino ${dest.id} está ocupado.`);
            }

            // Create Updates
            const newDest = {
                ...dest,
                programa: source.programa,
                contenido: source.contenido,
                notas: source.notas,
                cajas: source.cajas,
                cajasEstanteria: source.cajasEstanteria
            };

            const newSource = {
                ...source,
                programa: 'Vacio',
                contenido: source.id,
                notas: '',
                cajas: [],
                cajasEstanteria: {}
            };

            return {
                updates: [newSource, newDest],
                message: `✅ Movido contenido de ${source.id} a ${dest.id}.`
            };
        }

        // --- INTENT: ADD (ALTA) ---
        if (intent === 'ADD') {
            const targetLocName = destEnt?.text || sourceEnt?.text; // Sometimes NLP confuses LOCs
            if (!targetLocName) throw new Error("No sé dónde ponerlo (falta ubicación).");

            const target = findLocation(targetLocName);
            if (!target) throw new Error(`No encuentro la ubicación "${targetLocName}".`);

            const materialName = itemEnt?.text || "Material Nuevo";
            const qty = parseInt(qtyEnt?.text || "1") || 1;

            // Create Box
            const newBox: Caja = {
                id: `C-${crypto.randomUUID().slice(0, 5)}`,
                descripcion: materialName,
                programa: 'Otros',
                contenido: [{
                    id: crypto.randomUUID(),
                    nombre: materialName,
                    cantidad: qty,
                    estado: 'operativo',
                    materialId: 'gen-new'
                }]
            };

            const newTarget = { ...target };

            // If empty, set main headers
            if (newTarget.programa === 'Vacio') {
                newTarget.programa = 'Otros'; // Default program
                newTarget.contenido = `${materialName} (x${qty})`;
            }

            // Add to boxes list
            newTarget.cajas = [...(newTarget.cajas || []), newBox];

            return {
                updates: [newTarget],
                message: `✅ Añadido ${qty} x ${materialName} en ${target.id}.`
            };
        }

        // --- INTENT: GIFT ---
        if (intent === 'GIFT') {
            // Logic: Remove item/decrement stock.
            // Usually implies source location.
            const locName = sourceEnt?.text;
            if (!locName) throw new Error("¿De dónde saco el regalo? (Falta ubicación).");

            const source = findLocation(locName);
            if (!source) throw new Error(`No encuentro "${locName}".`);

            // Simplification: Empty the location (assuming user gifted the pallet content)
            // Or complex: Parse content.
            // MVP: Empty location and log message.

            const newSource = {
                ...source,
                programa: 'Vacio',
                contenido: source.id,
                cajas: []
            };

            return {
                updates: [newSource],
                message: `🎁 Registrado regalo desde ${source.id}. Ubicación liberada.`
            };
        }

        return { updates: [], message: "No entendí esa acción." };
    }
};
