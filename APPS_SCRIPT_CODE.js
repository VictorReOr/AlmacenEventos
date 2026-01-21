// --- CONFIGURACIÓN ---
const SHEET_NAME = "Mapa"; // Nombre de la pestaña

// --- API: LEER DATOS (GET) ---
function doGet(e) {
    return handleResponse(() => {
        const sheet = getSheet();
        const data = sheet.getDataRange().getValues();

        // Si la hoja está vacía (solo cabeceras o nada), devolvemos "vacio"
        if (data.length <= 1) return { status: "empty", locations: [], geometry: [] };

        // Mapear filas a objetos
        // Asumimos fila 0 = Cabeceras
        const headers = data[0];
        const rows = data.slice(1);

        // Buscar indices de columnas clave
        const colMap = mapHeaders(headers);

        const locations = {};
        let geometry = [];

        rows.forEach(row => {
            const type = row[colMap.tipo];

            // Si es una fila de "geometry_point", la añadimos a la geometría
            if (type === 'geometry_point') {
                geometry.push({
                    x: Number(row[colMap.x]),
                    y: Number(row[colMap.y])
                });
                return;
            }

            // Si es un objeto normal
            const id = String(row[colMap.id]);
            if (!id) return;

            const baseObj = {
                id: id,
                tipo: type,
                x: Number(row[colMap.x]),
                y: Number(row[colMap.y]),
                width: Number(row[colMap.width]),
                depth: Number(row[colMap.depth]),
                rotation: Number(row[colMap.rotation]),
                programa: row[colMap.programa],
                contenido: row[colMap.contenido],
                cantidad: Number(row[colMap.cantidad] || 0),
                notas: row[colMap.notas]
            };

            // Intentar parsear JSON extra (inventario, niveles)
            const jsonStr = row[colMap.datos_json];
            if (jsonStr && jsonStr !== "") {
                try {
                    const extra = JSON.parse(jsonStr);
                    Object.assign(baseObj, extra);
                } catch (err) {
                    // Ignorar error de parseo
                }
            }

            locations[id] = baseObj;
        });

        return {
            status: "success",
            ubicaciones: locations,
            geometry: geometry.length > 0 ? geometry : null
        };
    });
}

// --- API: GUARDAR DATOS (POST) ---
function doPost(e) {
    return handleResponse(() => {
        if (!e.postData || !e.postData.contents) throw new Error("No data received");

        const payload = JSON.parse(e.postData.contents);
        const locations = payload.ubicaciones || {};
        const geometry = payload.geometry || [];

        const sheet = getSheet();

        // Preparar nuevos datos
        // Cabeceras fijas para asegurar orden
        const headers = ["id", "tipo", "x", "y", "width", "depth", "rotation", "programa", "contenido", "cantidad", "notas", "datos_json"];

        const newRows = [headers];

        // 1. Añadir Ubicaciones
        Object.values(locations).forEach(loc => {
            // Separar datos planos de datos complejos (JSON)
            // Claves que van a columnas directas
            const directKeys = ["id", "tipo", "x", "y", "width", "depth", "rotation", "programa", "contenido", "cantidad", "notas"];

            // Todo lo demás va al JSON blob
            const extraData = {};
            Object.keys(loc).forEach(k => {
                if (!directKeys.includes(k) && k !== 'datos_json') {
                    extraData[k] = loc[k];
                }
            });

            const row = headers.map(h => {
                if (h === 'datos_json') return JSON.stringify(extraData);
                return loc[h] !== undefined ? loc[h] : "";
            });
            newRows.push(row);
        });

        // 2. Añadir Geometría (como filas especiales)
        geometry.forEach(pt => {
            // Usamos tipo 'geometry_point' y guardamos x,y. El resto vacio.
            // id = geo_INDEX
            const row = headers.map(h => {
                if (h === 'tipo') return 'geometry_point';
                if (h === 'x') return pt.x;
                if (h === 'y') return pt.y;
                return "";
            });
            newRows.push(row);
        });

        // Limpiar contenido existente de forma segura
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow > 0 && lastCol > 0) {
            sheet.getRange(1, 1, lastRow, lastCol).clearContent();
        }

        // Escribir nuevos datos
        if (newRows.length > 0) {
            sheet.getRange(1, 1, newRows.length, headers.length).setValues(newRows);
        }

        return { status: "success", message: "Data saved successfully", count: newRows.length - 1 };
    });
}

// --- HELPERS ---

function getSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
    }
    return sheet;
}

function mapHeaders(headers) {
    const map = {};
    headers.forEach((h, i) => map[h] = i);
    return map;
}

function handleResponse(func) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // Evitar colisiones de escritura

    try {
        const result = func();
        return ContentService
            .createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (e) {
        return ContentService
            .createTextOutput(JSON.stringify({ status: "error", message: e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
