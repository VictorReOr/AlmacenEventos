const fs = require('fs');
const file = 'src/WarehouseMap.tsx';
let content = fs.readFileSync(file, 'utf8');

const renderVisualsIndex = content.indexOf('const renderVisuals = () => {');
if (renderVisualsIndex === -1) throw new Error("No renderVisuals found");

const estanteriaStartSearch = `        if (u.tipo === 'estanteria_modulo') {`;
const block1Start = content.indexOf(estanteriaStartSearch, renderVisualsIndex);
if (block1Start === -1) throw new Error("No estanteria found");

const zonaCargaSearch = `        } else if (u.tipo === 'zona_carga') {`;
const block1End = content.indexOf(zonaCargaSearch, renderVisualsIndex);
if (block1End === -1) throw new Error("No zona_carga found");

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


// Recalculate index after first replacement
const renderVisualsIndex2 = content.indexOf('const renderVisuals = () => {');

const paleStartSearch = `        } else { // Palé`;
const block2Start = content.indexOf(paleStartSearch, renderVisualsIndex2);
if (block2Start === -1) throw new Error("No pale found");

const returnContentSearch = `        return content;`;
const block2End = content.indexOf(returnContentSearch, block2Start);
if (block2End === -1) throw new Error("No return content found");

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

content = content.substring(0, block2Start) + palletReplacement + content.substring(block2End);

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

fs.writeFileSync(file, content);
console.log('Reemplazo SUPER SEGURO completado con éxito.');
