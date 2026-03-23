// test-parse
fetch('https://script.google.com/macros/s/AKfycbwPJThfJGQXx1J-TnRHtgZlh_TmrpZXBvMDTyomvy6BOnL9ebuZuYmt_ZH4hQ74DiAh/exec')
    .then(res => res.json())
    .then(data => {
        const rawData = data.inventoryRows || data;
        const shelves = {};
        const pallets = {};

        const getValue = (item, keys) => {
            for (const key of keys) {
                if (item[key] !== undefined) return item[key];
                const found = Object.keys(item).find(k => k.toUpperCase() === key.toUpperCase());
                if (found) return item[found];
            }
            return undefined;
        };

        rawData.forEach(item => {
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
            if (!locationId) return;

            locationId = String(locationId).trim().toUpperCase();

            const shelfMatch = locationId.match(/^E.*?([0-9]+[A-Z]?).*?M.*?(\d+).*?A.*?(\d+)/i);

            if (shelfMatch) {
                const shelfIdStr = shelfMatch[1].replace(/^0+/, '');
                const modNum = parseInt(shelfMatch[2], 10);
                const levelNum = parseInt(shelfMatch[3], 10);

                const shelfId = `E${shelfIdStr}`;
                const slotId = `M${modNum}-A${levelNum}`;

                if (!shelves[shelfId]) shelves[shelfId] = {};
                if (!shelves[shelfId][slotId]) shelves[shelfId][slotId] = [];
                shelves[shelfId][slotId].push(item);
                return;
            }

            const parts = locationId.split('-');
            if (parts.length >= 3 && locationId.startsWith('E')) {
                const shelfId = parts[0];
                const slotId = `${parts[1]}-${parts[2]}`;
                if (!shelves[shelfId]) shelves[shelfId] = {};
                if (!shelves[shelfId][slotId]) shelves[shelfId][slotId] = [];
                shelves[shelfId][slotId].push(item);
            } else {
                if (/^\d+$/.test(locationId)) {
                    locationId = String(parseInt(locationId, 10));
                }
                if (!pallets[locationId]) pallets[locationId] = [];
                pallets[locationId].push(item);
            }
        });

        console.log("Shelves found:", Object.keys(shelves));
        console.log("E4A details:", JSON.stringify(shelves['E4A'], null, 2));
        console.log("E4B details:", JSON.stringify(shelves['E4B'], null, 2));
        console.log("E8 details:", JSON.stringify(shelves['E8'], null, 2));
    });
