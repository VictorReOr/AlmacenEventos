
// -------------------------------------------------------------------------
// GOOGLE APPS SCRIPT CODE - DATABASE MODE
// -------------------------------------------------------------------------
// Instrucciones:
// 1. Copia este código en tu proyecto de Google Apps Script (sobrescribe lo anterior).
// 2. Despliega de nuevo como "Nueva implantación" (Versión: Nueva).
// 3. Actualiza la URL en la App si cambia.
// -------------------------------------------------------------------------

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

// --- MANEJO DE PETICIONES ---
function handleRequest(e) {
    var lock = LockService.getScriptLock();
    // Intentar obtener bloqueo por 10 segundos
    if (!lock.tryLock(10000)) {
        return respuestaJSON({ status: 'error', message: 'Servidor ocupado. Inténtalo de nuevo más tarde.' });
    }

    try {
        var sheetId = getSheetId();
        var ss = SpreadsheetApp.openById(sheetId);

        // --- POST (GUARDAR) ---
        if (e.postData) {
            var cargaUtil = JSON.parse(e.postData.contents);
            guardarDatos(ss, cargaUtil);
            return respuestaJSON({ status: 'success' });
        }
        // --- GET (CARGAR) ---
        else {
            var datos = cargarDatos(ss);
            return respuestaJSON({
                status: 'success',
                configJson: datos.configJson,
                filasInventario: datos.filasInventario
            });
        }

    } catch (err) {
        return respuestaJSON({ status: 'error', message: err.toString() });
    } finally {
        lock.releaseLock();
    }
}

// --- LÓGICA DE GUARDADO ---
function guardarDatos(ss, payload) {
    // 1. HOJA CONFIG (Respaldo Técnico)
    var configSheet = ensureSheet(ss, 'Config');
    configSheet.clear();
    configSheet.getRange("A1").setValue("FULL_STATE_JSON");
    configSheet.getRange("B1").setValue(payload.configJson || "{}");

    // 2. HOJA INVENTARIO (Vista Usuario)
    var invSheet = ensureSheet(ss, 'Inventario');
    invSheet.clear();

    // Cabeceras Simples
    var headers = ["ID", "Cantidad", "Contenido", "Programa", "Tipo"];
    invSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    var rows = [];
    var invData = payload.inventoryRows || [];

    invData.forEach(function (item) {
        rows.push([
            item.id,
            item.cantidad || 1,
            item.contenido || "",
            item.programa || "",
            item.tipo || ""
        ]);
    });

    if (rows.length > 0) {
        invSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // Aplicar Formato
    formatInventorySheet(invSheet);
}

// --- LÓGICA DE CARGA ---
function cargarDatos(ss) {
    // 1. Cargar Configuración Técnica
    var configSheet = ss.getSheetByName('Config');
    var configJson = "{}";
    if (configSheet) {
        configJson = configSheet.getRange("B1").getValue();
    }

    // 2. Cargar Inventario
    var invSheet = ss.getSheetByName('Inventario');
    var inventoryRows = [];

    if (invSheet && invSheet.getLastRow() > 1) {
        // ID, Cantidad, Contenido, Programa, Tipo (5 Cols)
        var data = invSheet.getRange(2, 1, invSheet.getLastRow() - 1, 5).getValues();

        data.forEach(function (row) {
            var id = String(row[0]);
            if (!id) return;

            inventoryRows.push({
                id: id,
                cantidad: row[1],
                contenido: String(row[2]),
                programa: String(row[3]),
                tipo: String(row[4])
            });
        });
    }

    return { configJson: configJson, inventoryRows: inventoryRows };
}

// --- HELPER: Asegurar Hoja ---
function ensureSheet(ss, name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
    }
    return sheet;
}

// --- HELPER: Formatear Hoja Inventario ---
function formatInventorySheet(sheet) {
    if (sheet.getLastRow() <= 1) return;

    var range = sheet.getDataRange();

    // Colores Alternos
    try {
        range.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    } catch (e) {
        // Puede que ya exista
    }

    // Auto-ajustar columnas
    sheet.autoResizeColumns(1, 5);
}

// --- CONFIGURACIÓN DE BASE DE DATOS (SETUP) ---
function setupDatabase() {
    var ss;
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
        var sheetId = getSheetId();
        ss = SpreadsheetApp.openById(sheetId);
    }

    if (!ss) return;

    var sheetsConfig = [
        { name: 'A_Materiales', headers: ["ID", "Nombre", "Descripcion", "Categoria", "SKU", "Unidad"] },
        { name: 'B_Ubicaciones', headers: ["ID", "Tipo", "Parent_ID", "Capacidad", "Estado"] },
        { name: 'C_Stock', headers: ["Material_ID", "Ubicacion_ID", "Cantidad", "Estado"] },
        { name: 'D_Historial', headers: ["Timestamp", "Transaction_ID", "User_ID", "Accion", "Material_ID", "Cantidad", "Origen_ID", "Destino_ID", "Prueba_Data"] },
        { name: 'Z_Config_Usuarios', headers: ["User_ID", "Rol", "Permisos"] },
        { name: 'Config', headers: ["KEY", "VALUE"] }
    ];

    sheetsConfig.forEach(function (cfg) {
        var sheet = ensureSheet(ss, cfg.name);
        if (sheet.getLastRow() === 0) {
            sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
            formatSheetHeader(sheet, cfg.headers.length);
        }
    });

    Logger.log("✅ Esquema Aplicado!");
    Logger.log("📂 URL: " + ss.getUrl());
}

function formatSheetHeader(sheet, cols) {
    var range = sheet.getRange(1, 1, 1, cols);
    range.setFontWeight("bold")
        .setBackground("#455A64")
        .setFontColor("white")
        .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
}

function getSheetId() {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SHEET_ID');
    if (!id) {
        var ss = SpreadsheetApp.create("Warehouse_DB");
        id = ss.getId();
        props.setProperty('SHEET_ID', id);
        Logger.log("🆕 Hoja Creada: " + ss.getUrl());
    }
    return id;
}

function respuestaJSON(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
