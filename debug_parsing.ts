
interface RawShelfItem {
    [key: string]: any;
}

const mockData = [
    { "ID_REGISTRO": "E1-M1-A1", "TIPO_UBICACION": "estanteria", "ID_LUGAR": "E1", "MODULO": "1", "ALTURA": "1", "TIPO_ITEM": "Caja", "MATERIAL": "Caja de 5 extintores", "CANTIDAD": 1, "LOTE": "Andalucía", "ESTADO": "", "RESPONSABLE": "", "OBSERVACIONES": "" }
];

const getValue = (item: any, keys: string[]) => {
    for (const key of keys) {
        if (item[key] !== undefined) return item[key];
        const found = Object.keys(item).find(k => k.toUpperCase() === key.toUpperCase());
        if (found) return item[found];
    }
    return undefined;
};

const parse = (data: RawShelfItem[]) => {
    const shelves: Record<string, Record<string, any[]>> = {};
    const pallets: Record<string, any[]> = {};
    const messages: string[] = [];

    data.forEach(item => {
        const idUbicacion = getValue(item, ['ID_UBICACION', 'UBICACION']);
        const idRegistro = getValue(item, ['ID_REGISTRO', 'REGISTRO', 'ID']);
        const idLugar = getValue(item, ['ID_LUGAR', 'LUGAR']);
        const modulo = getValue(item, ['MODULO', 'MOD']);
        const altura = getValue(item, ['ALTURA', 'NIVEL', 'HEIGHT']);

        let locationId = String(idUbicacion || idRegistro || '').trim().toUpperCase();

        if (!locationId && idLugar && modulo && altura) {
            locationId = `${idLugar}-M${modulo}-A${altura}`.toUpperCase();
        }

        if (!locationId && idLugar) {
            locationId = String(idLugar).trim().toUpperCase();
        }

        messages.push(`Item LocationID: ${locationId}`);

        const shelfMatch = locationId.match(/^E.*?(\d+).*?M.*?(\d+).*?A.*?(\d+)/);

        if (shelfMatch) {
            const shelfNum = parseInt(shelfMatch[1], 10);
            const modNum = parseInt(shelfMatch[2], 10);
            const levelNum = parseInt(shelfMatch[3], 10);

            const shelfId = `E${shelfNum}`;
            const slotId = `M${modNum}-A${levelNum}`;

            messages.push(`Identified Shelf: ${shelfId}, Slot: ${slotId}`);

            if (!shelves[shelfId]) shelves[shelfId] = {};
            if (!shelves[shelfId][slotId]) shelves[shelfId][slotId] = [];
            shelves[shelfId][slotId].push(item);
        } else {
            messages.push("Shelf Regex FAILED");
            if (/^\d+$/.test(locationId)) {
                // Pallet
                messages.push(`Identified Pallet: ${locationId}`);
            }
        }
    });

    return { shelves, messages };
}

const result = parse(mockData);
console.log(JSON.stringify(result, null, 2));
