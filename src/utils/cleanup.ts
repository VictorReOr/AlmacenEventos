
import { generateInitialState } from '../data';
import type { AlmacenState, Ubicacion } from '../types';

export const sanitizeState = (state: AlmacenState): AlmacenState => {
    console.log("🛡️ Rehidratación Estricta: Imponiendo Supremacía del Código...");

    // 1. Obtener Estructuras Canónicas (Supremacía del Código)
    // El archivo 'data.ts' es la ÚNICA fuente de la verdad para IDs y Geometría.
    const pristineState = generateInitialState();
    const cleanUbicaciones: Record<string, Ubicacion> = {};
    let rehydratedCount = 0;
    let ghostsRemoved = 0;

    // Inicializar con TODAS las Estructuras Impolares (Estanterías Y Palés)
    // Esto asegura que comenzamos con la X, Y, W, H, y Rotación correctas del código.
    Object.values(pristineState.ubicaciones).forEach(u => {
        cleanUbicaciones[u.id] = { ...u };
    });

    // 2. Procesar Estado de Entrada (Nube/Local) SOLO para Hidratar Inventario
    Object.values(state.ubicaciones).forEach(u => {
        // Si el ID existe en nuestro Mapa Impolar (Pristine), es válido.
        if (cleanUbicaciones[u.id]) {
            const target = cleanUbicaciones[u.id];

            // Hidratar campos de Inventario desde Almacenamiento
            // IGNORAMOS CONSCIENTEMENTE 'x', 'y', 'rotation' del almacenamiento para forzar un reseteo de diseño.
            // Esto es necesario para limpiar posiciones "fantasma".
            if (u.cajas) target.cajas = u.cajas;
            if (u.materiales) target.materiales = u.materiales;
            if (u.items) target.items = u.items;
            if (u.shelfItems) target.shelfItems = u.shelfItems;

            // Manejar propiedades de legado potencialmente sin tipar
            const uAny = u as any;
            const targetAny = target as any;
            if (uAny.cajasEstanteria) targetAny.cajasEstanteria = uAny.cajasEstanteria;
            if (uAny.niveles) targetAny.niveles = uAny.niveles;

            // Actualizaciones de Programas/Contenidos
            if (u.programa) target.programa = u.programa;
            if (u.contenido) target.contenido = u.contenido;

            // Etiquetas (Permitir posicionamiento manual libre sobreescribiendo data.ts)
            if (u.labelX !== undefined) target.labelX = u.labelX;
            if (u.labelY !== undefined) target.labelY = u.labelY;
            if (u.labelRot !== undefined) target.labelRot = u.labelRot;

            rehydratedCount++;
        } else {
            // Estructura en Nube pero NO en Código = FANTASMA.
            // Esto atrapa palés de legado (ej. "67") y objetos desconocidos.
            console.warn(`👻 Ghost Structure Busting: Discarded ${u.id} (${u.tipo})`);
            ghostsRemoved++;
        }
    });

    // 3. (Opcional) Validación
    // Dado que forzamos la geometría de 'data.ts', confiamos en que está libre de colisiones.

    console.log(`✅ Sanitize Complete. Hydrated: ${rehydratedCount}, Ghosts Busted: ${ghostsRemoved}`);

    return {
        ubicaciones: cleanUbicaciones,
        geometry: pristineState.geometry
    };
};
