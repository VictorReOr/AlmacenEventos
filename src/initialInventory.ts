import type { Ubicacion, Caja, MaterialEnCaja } from './types';

// Helper to create simple material items
const createItem = (name: string, qty: number = 1): MaterialEnCaja => ({
    id: crypto.randomUUID(),
    materialId: 'gen-mat',
    nombre: name,
    cantidad: qty,
    estado: 'operativo'
});

// Helper to create a Box wrapper for a Pallet
// Helper to create Boxes directly from descriptions
const createPalletBox = (items: string[], program: string = 'Vacio'): Caja[] => {
    return items.map(desc => {
        // 1. Detect Quantity: "Caja de Balones (x8)" or "Caja (x8)"
        let qty = 1;
        let cleanName = desc;

        // Regex for (x8) or (8 uds) at end or start
        const qtyMatch = desc.match(/\(x(\d+)\)/i) || desc.match(/^(\d+)\s+(.+)$/);

        if (qtyMatch) {
            qty = parseInt(qtyMatch[1] || qtyMatch[0]); // For (x8) match[1] is 8. For "8 Caja" match[1] is 8.
            // Clean name: remove the (x8) part
            cleanName = desc.replace(/\(x\d+\)/i, '').replace(/^\d+\s+/, '').trim();
        }

        // 2. Classify: Is it a Box or Loose Item?
        // User wants unified list. But data model distinguishes.
        // For Pallets, we originally used "Caja Principal". Now we want specific Boxes on the pallet.
        // If the name says "Caja", we treat it as a Box.
        // If it doesn't, we effectively treat it as a "Box" container for that loose item for now 
        // OR we should split return types.
        // BUT, the function signature is `Caja[]`.
        // Let's create a Wrapper Box for each line item.
        // This effectively makes every line item in the input list a "Box Object" on the pallet.
        // The UI will distinguish icon based on specific "Caja" keyword in name.

        return {
            id: `BX-${crypto.randomUUID().slice(0, 6)}`,
            descripcion: cleanName,
            programa: program,
            cantidad: qty, // New field
            contenido: [] // Empty because the "Box" IS the item card now
        };
    });
};

// Helper for Shelf Slots
const createShelfBox = (items: string[], program: string = 'Vacio'): Caja => ({
    id: `C-${crypto.randomUUID().slice(0, 6)}`,
    descripcion: 'Contenido Posición',
    programa: program,
    contenido: items.map(desc => {
        const match = desc.match(/^(\d+)\s+(.+)$/);
        if (match) {
            return createItem(match[2], parseInt(match[1]));
        }
        return createItem(desc);
    })
});

// --- DATA DEFINITION ---

export const INITIAL_INVENTORY_UPDATES: Record<string, Partial<Ubicacion>> = {
    // --- PALETS ---
    "1": { programa: "Mentor 10", cajas: createPalletBox(["Caja de Pelotas de Foam (Baloncesto) (x8)"], "Mentor 10") },
    "2": {
        programa: "Liga LED", cajas: createPalletBox([
            "Caja de Balones Ciegos (x5)",
            "Caja de Balones Baloncesto (x5)",
            "Balones de Goma Espuma",
            "Caja de Pelotas de Pinpon (pequeñas)"
        ], "Liga LED")
    },
    "3": {
        programa: "Liga LED", cajas: createPalletBox([
            "Caja de Balones Futbol 7",
            "Caja de Pelotas waterpolo (Balones amarillos) (x2)",
            "Caja de Pelotas waterpolo (Balones de colores)"
        ], "Liga LED")
    },
    "4": {
        programa: "Liga M100", cajas: createPalletBox([
            "Caja de Mundial (x8)",
            "Caja de Futsala",
            "1 unidad de Futbol Goma",
            "Caja de Futbol 7 Talla 4 (x2)",
            "Pizarras Futbol"
        ], "Liga M100")
    },
    "5": {
        programa: "Otros", cajas: createPalletBox([
            "Caja grande de Pelotas Pin Pon",
            "Caja de Balonmano (x3)",
            "Caja de Baloncesto y fitnall",
            "Caja de Voley (x4)",
            "Caja de Voley Plástico",
            "Caja de mini Pelotas Europa / Conference (x2)"
        ], "Otros")
    },
    "6": { programa: "Otros", cajas: createPalletBox(["34 Cajas de Relojes"], "Otros") },
    "7": { programa: "Otros", cajas: createPalletBox(["Caja de líneas de campo", "Bolas Duras / Todo Lacrosse"], "Otros") },
    "8": { programa: "Vacio", contenido: "Leeda (C)", cajas: createPalletBox(["Agrupado CEEDA/LEEDA"], "Vacio") },
    "9": { programa: "Vacio", contenido: "Leeda (C)", cajas: createPalletBox(["Agrupado CEEDA/LEEDA"], "Vacio") },
    "10": { programa: "Vacio", contenido: "Leeda (C)", cajas: createPalletBox(["Agrupado CEEDA/LEEDA"], "Vacio") },
    "11": { programa: "Vacio", contenido: "Leeda (C)", cajas: createPalletBox(["Agrupado CEEDA/LEEDA"], "Vacio") },
    "12": { programa: "Vacio", contenido: "Leeda (C)", cajas: createPalletBox(["Agrupado CEEDA/LEEDA"], "Vacio") },

    "13": { programa: "Otros", cajas: createPalletBox(["Ploggin", "Esterillas"], "Otros") },
    "14": { programa: "Otros", cajas: createPalletBox(["Conos (aprox. 180 unidades)"], "Otros") },
    "15": { programa: "Otros", cajas: createPalletBox(["27 Garrafas de Agua"], "Otros") },
    "16": { programa: "Liga LED", cajas: createPalletBox(["Video cámaras"], "Liga LED") },

    "17": { programa: "Liga LED", cajas: createPalletBox(["3 arcos de meta", "4 arcos liga led", "2 disfraces liga led", "20 sillas aproximadamente"], "Liga LED") },
    "18": { programa: "Liga LED", cajas: createPalletBox(["(Ver Palet 17) Arcos y Sillas"], "Liga LED") },

    "19": { programa: "Otros", cajas: createPalletBox(["Vallas amarillas"], "Otros") },
    "20": { programa: "Otros", cajas: createPalletBox(["8 porterías"], "Otros") },


    // --- ESTANTERÍA 1 (E1) ---
    "E1": {
        cajasEstanteria: {
            "M1-A1": createShelfBox(["Caja de 5 extintores", "Caja con 20 bolsas Andalucía pequeñas"]),
            "M1-A2": createShelfBox(["Caja con estuches de Reloj sin relojes", "Caja de polos azules Andalucía"]),
            "M1-A3": createShelfBox(["Caja con mascarillas M10 (x2)"]),
            "M1-A4": createShelfBox(["8 Rollos de cinta fina para marcar", "1 cinta carrocero", "2 cintas de Velcro", "Caja de pulseras Liga LED", "Paquete de vasos de cartón (x4)", "Caja de calendarios metal", "Caja con 20 post-it de colores", "Caja de torniquetes", "Caja de PEN USB", "Caja de calculadoras (x2)"]),

            "M2-A1": createShelfBox(["Caja de camisetas variadas", "Caja de calzonas tipo chándal Andalucía"]),
            "M2-A2": createShelfBox(["Caja de calzonas tipo chándal Andalucía", "Caja de PEN DRIVE tipo tarjeta"]),
            // "M2-A3": undefined, // LIBRE
            "M2-A4": createShelfBox(["Camisas blancas Andalucía"]),

            "M3-A1": createShelfBox(["Esterillas Rojas"]),
            "M3-A2": createShelfBox(["Caja de Ropa variada de marca (x3)"]),
            "M3-A3": createShelfBox(["Caja Mochilas liga LED (x2)"]),
            "M3-A4": createShelfBox(["Caja Mochilas liga LED", "Caja Lanyard Liga LED"]),
        }
    },

    // --- ESTANTERÍA 2 (E2) ---
    "E2": {
        cajasEstanteria: {
            "M1-A1": createShelfBox(["Caja con piquetas y zapatillas futbol", "Caja con zapatillas futbol", "Caja con esterillas"]),
            "M1-A2": createShelfBox(["Caja de Bolsas de M100 (x4)"]),

            "M2-A1": createShelfBox(["Caja de tazos", "Caja de Esterillas color variado"]),
            "M2-A2": createShelfBox(["Caja de Troleys (x4)"]),
            // "M2-A3": undefined, // LIBRE
            "M2-A4": createShelfBox(["Caja de tensiómetros (30 uds)", "Caja de Cuadernos de trabajo Andalucía (x4)"]),

            "M3-A1": createShelfBox(["Caja de COPA ESPECIAL (12 uds) (x2)"]),
            "M3-A2": createShelfBox(["Caja de Vasos isotérmicos", "Caja de Bolses de papel de Andalucía (x2)", "Caja de Blocs de notas negro (x2)"]),
            "M3-A3": createShelfBox(["Caja de bolsas de papel andalucía (x3)"]),
            "M3-A4": createShelfBox(["Caja de carpetas de piel negras (x3)"]),

            "M4-A1": createShelfBox(["Caja de 12 unidades de COPA ESPECIAL (x2)"]),
            "M4-A2": createShelfBox(["Caja de esterillas verdes (x4)", "Caja de pulseras tela"]),
            // "M4-A3": undefined, // LIBRE
            "M4-A4": createShelfBox(["Caja de lanyards variados"]),

            "M5-A1": createShelfBox(["Caja de trofeos (x2)"]),
            "M5-A2": createShelfBox(["Caja de trofeos (x2)"]),
            "M5-A3": createShelfBox(["Caja de trofeos (x2)"]),
            "M5-A4": createShelfBox(["Caja de Landeyard amarillos", "Caja de calzonas de Andalucía de niño"]),

            "M6-A1": createShelfBox(["Botellas de Agua"]),
            // "M6-A2": undefined, // LIBRE
            "M6-A3": createShelfBox(["Caja de troleys (x2)", "Caja de landyards (x2)"])
        }
    }
};
