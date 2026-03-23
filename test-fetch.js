fetch('https://script.google.com/macros/s/AKfycbwPJThfJGQXx1J-TnRHtgZlh_TmrpZXBvMDTyomvy6BOnL9ebuZuYmt_ZH4hQ74DiAh/exec')
    .then(res => res.json())
    .then(data => {
        const rows = data.inventoryRows || data;
        const filtered = rows.filter(r => {
            const id = String(r['ID_LUGAR'] || r['LUGAR'] || r['ID_REGISTRO'] || r['ID_UBICACION'] || '').toUpperCase();
            return id.includes('E4') || id.includes('E8');
        });
        console.log(JSON.stringify(filtered.slice(0, 5), null, 2));
    })
    .catch(console.error);
