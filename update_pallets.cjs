const fs = require('fs');

const generatePallets = () => {
    const pallets = {};

    // 1-16: West Wall
    for (let i = 1; i <= 16; i++) {
        const id = i.toString();
        const pos = i - 1;
        pallets[id] = {
            id, tipo: 'palet', programa: 'Vacio', contenido: id,
            x: Number((0.2642875 + pos * 0.0302575).toFixed(6)),
            y: Number((15.25 - pos * 0.95).toFixed(6)),
            rotation: 88.18, width: 0.8, depth: 1.2
        };
    }

    // 17-20: North Wall
    const startXNorth = 2.1;
    const spacingNorth = 1.6;
    for (let i = 17; i <= 20; i++) {
        const id = i.toString();
        const pos = i - 17;
        pallets[id] = {
            id, tipo: 'palet', programa: 'Vacio', contenido: id,
            x: Number((startXNorth + pos * spacingNorth).toFixed(6)),
            y: 0.85,
            rotation: 90, width: 0.8, depth: 1.2
        };
    }

    // 21-37: East Wall
    for (let i = 21; i <= 37; i++) {
        const id = i.toString();
        const pos = i - 21;
        pallets[id] = {
            id, tipo: 'palet', programa: 'Vacio', contenido: id,
            x: Number((7.473125 + pos * 0.06946875).toFixed(6)),
            y: Number((1.0 + pos * 0.95).toFixed(6)),
            rotation: 94.18, width: 0.8, depth: 1.2
        };
    }

    // 38-53: Center Left
    for (let i = 38; i <= 53; i++) {
        const id = i.toString();
        const pos = i - 38;
        pallets[id] = {
            id, tipo: 'palet', programa: 'Vacio', contenido: id,
            x: 3.4,
            y: Number((4.0 + pos * 0.95).toFixed(6)),
            rotation: 90, width: 0.8, depth: 1.2
        };
    }

    // 54-69: Center Right
    for (let i = 54; i <= 69; i++) {
        const id = i.toString();
        const pos = i - 54;
        pallets[id] = {
            id, tipo: 'palet', programa: 'Vacio', contenido: id,
            x: 4.6,
            y: Number((18.25 - pos * 0.95).toFixed(6)),
            rotation: 90, width: 0.8, depth: 1.2
        };
    }

    return pallets;
};

const newPallets = generatePallets();
const oldData = fs.readFileSync('src/data.ts', 'utf-8');

const startIdx = oldData.indexOf('"1": {');
const endIdx = oldData.indexOf('"E2": {');

if (startIdx > -1 && endIdx > -1) {
    let newPalletsString = '';
    for (const [id, p] of Object.entries(newPallets)) {
        newPalletsString += `        "${id}": ${JSON.stringify(p, null, 4).replace(/\n/g, '\n        ')},\n`;
    }

    const newData = oldData.substring(0, startIdx) + newPalletsString + '\n        ' + oldData.substring(endIdx);
    fs.writeFileSync('src/data.ts', newData);
    console.log('✅ Updated src/data.ts with ' + Object.keys(newPallets).length + ' pallets.');
} else {
    console.error('Could not find boundaries.');
}
