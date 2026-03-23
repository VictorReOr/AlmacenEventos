const fs = require('fs');
const file = 'src/WarehouseMap.tsx';
let content = fs.readFileSync(file, 'utf8');

// Agregar Imports
const importTarget1 = `import { getLotAttributes } from './utils/lotVisualizer';\r\nimport type { SnapLine } from './geometry';`;
const importTarget2 = `import { getLotAttributes } from './utils/lotVisualizer';\nimport type { SnapLine } from './geometry';`;
const importReplacement = `import { getLotAttributes } from './utils/lotVisualizer';\nimport type { SnapLine } from './geometry';\nimport { ShelfGraphic } from './components/Map/ShelfGraphic';\nimport { PalletGraphic } from './components/Map/PalletGraphic';`;

if (content.includes(importTarget1)) {
    content = content.replace(importTarget1, importReplacement);
} else if (content.includes(importTarget2)) {
    content = content.replace(importTarget2, importReplacement);
} else {
    // Si no se encuentra exactamente, lo insertamos después de getLotAttributes
    content = content.replace(/import \{ getLotAttributes \} from '\.\/utils\/lotVisualizer';/, `import { getLotAttributes } from './utils/lotVisualizer';\nimport { ShelfGraphic } from './components/Map/ShelfGraphic';\nimport { PalletGraphic } from './components/Map/PalletGraphic';`);
}

// Reemplazar Bloque Shelf
const block1Start = content.indexOf(`        if (u.tipo === 'estanteria_modulo') {`);
const block1End = content.indexOf(`        } else if (u.tipo === 'zona_carga') {`);

if (block1Start !== -1 && block1End !== -1) {
    const shelfReplacement = `        if (u.tipo === 'estanteria_modulo') {
            content = (
                <ShelfGraphic
                    u={u}
                    finalSvgW={finalSvgW}
                    finalSvgH={finalSvgH}
                    rotationMode={rotationMode}
                    SCALE={SCALE}
                    programColors={programColors || {}}
                    isSelected={isSelected}
                    interactionMode={interactionMode}
                    readOnly={readOnly || false}
                    bindMove={bindMove}
                    bindLabelMove={bindLabelMove}
                    liveLabelPos={liveLabelPos}
                    rawLabelPos={rawLabelPos}
                    currentRot={currentRot}
                    onUpdate={onUpdate}
                    SHELF_MODULE_WIDTH={SHELF_MODULE_WIDTH}
                />
            );
`;
    content = content.substring(0, block1Start) + shelfReplacement + content.substring(block1End);
} else {
    console.error("No se encontró el bloque 1 (estanteria_modulo)");
}

// Reemplazar Bloque Pallet
const block2Start = content.indexOf(`        } else { // Palé`);
const block2End = content.lastIndexOf(`        return content;\n    };\n`);

if (block2Start !== -1) {
    // Encontrar el último return content de renderVisuals
    let endIdx = content.indexOf(`        return content;`, block2Start);
    if (endIdx !== -1) {
        const palletReplacement = `        } else { // Palé
            content = (
                <PalletGraphic
                    u={u}
                    finalSvgW={finalSvgW}
                    finalSvgH={finalSvgH}
                    rotationMode={rotationMode}
                    programColors={programColors || {}}
                    isSelected={isSelected}
                    currentRot={currentRot}
                    isValid={isValid || false}
                />
            );
        }
`;
        content = content.substring(0, block2Start) + palletReplacement + content.substring(endIdx);
    } else {
        console.error("No se encontró el fin del bloque 2 (return content)");
    }
} else {
    console.error("No se encontró el bloque 2 (Palé)");
}

fs.writeFileSync(file, content);
console.log('Reemplazo completado con éxito.');
