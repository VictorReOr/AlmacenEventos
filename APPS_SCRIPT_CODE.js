
// -------------------------------------------------------------------------
// GOOGLE APPS SCRIPT CODE - DATABASE MODE
// -------------------------------------------------------------------------
// Instructions:
// 1. Copy this code into your Google Apps Script project (overwrite previous).
// 2. Deploy again as "New Deployment" (Version: New).
// 3. Update the URL in the App if it changes (usually stays same if you manage deployment right, but safer to check).
// -------------------------------------------------------------------------

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

// --- HANDLE REQUEST ---
function handleRequest(e) {
    var lock = LockService.getScriptLock();
    // Try to get the lock, fail if not possible within 10 seconds
    if (!lock.tryLock(10000)) {
        return responseJSON({ status: 'error', message: 'Server is busy. Try again later.' });
    }

    try {
        var sheetId = getSheetId();
        var ss = SpreadsheetApp.openById(sheetId);

        // --- POST (SAVE FROM APP) ---
        if (e.postData) {
            var payload = JSON.parse(e.postData.contents);
            saveData(ss, payload);
            return responseJSON({ status: 'success' });
        }

        // --- GET (LOAD TO APP) ---
        else {
            var data = loadData(ss);
            return responseJSON({
                status: 'success',
                configJson: data.configJson,
                inventory: data.inventory
            });
        }

    } catch (err) {
        return responseJSON({ status: 'error', message: err.toString() });
    } finally {
        lock.releaseLock();
    }
}

// --- SAVING LOGIC ---
function saveData(ss, payload) {
    // 1. CONFIG SHEET (Technical Backup)
    var configSheet = ensureSheet(ss, 'Config');
    configSheet.clear();
    configSheet.getRange("A1").setValue("FULL_STATE_JSON");
    // payload.configJson contains the full App State (geometry, objects, positions)
    configSheet.getRange("B1").setValue(payload.configJson || "{}");

    // 2. INVENTARIO SHEET (User View)
    var invSheet = ensureSheet(ss, 'Inventario');
    invSheet.clear();

    // Simple Headers (User Friendly)
    var headers = ["ID", "Cantidad", "Contenido", "Programa", "Tipo"];
    invSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    var rows = [];
    var invData = payload.inventoryRows || []; // Expecting clean array from App

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

    // Apply Formatting
    formatInventorySheet(invSheet);
}

// --- LOADING LOGIC ---
function loadData(ss) {
    // 1. Load Technical Config
    var configSheet = ss.getSheetByName('Config');
    var configJson = "{}";
    if (configSheet) {
        configJson = configSheet.getRange("B1").getValue();
    }

    // 2. Load Inventory User Edits
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
                cantidad: row[1], // Cantidad
                contenido: String(row[2]), // Contenido
                programa: String(row[3]), // Programa
                tipo: String(row[4])      // Tipo
            });
        });
    }

    return { configJson: configJson, inventoryRows: inventoryRows };
}

function ensureSheet(ss, name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
    }
    return sheet;
}

// --- SETUP & UTILS ---
function setup() {
    var ss;
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
        Logger.log("⚠️ Could not get active spreadsheet. Trying stored ID...");
    }

    if (ss) {
        // We are inside the sheet script editor, so BIND to this sheet
        var id = ss.getId();
        PropertiesService.getScriptProperties().setProperty('SHEET_ID', id);
        Logger.log("🔗 LINKED to Current Sheet: " + ss.getName());
    } else {
        // Fallback: Use stored or create new
        var sheetId = getSheetId();
        ss = SpreadsheetApp.openById(sheetId);
    }

    // Format Inventario
    var invSheet = ensureSheet(ss, 'Inventario');

    // Apply Formatting
    formatInventorySheet(invSheet);

    Logger.log("✅ Database Formatted Successfully!");
    Logger.log("📂 OPEN YOUR SHEET HERE: " + ss.getUrl());
}

function formatInventorySheet(sheet) {
    var rows = Math.max(sheet.getLastRow(), 20);
    var cols = Math.max(sheet.getLastColumn(), 10);

    // Clear old banding to prevent errors
    var bandings = sheet.getBandings();
    if (bandings) {
        bandings.forEach(function (b) { b.remove(); });
    }

    // Apply New Banding
    var range = sheet.getRange(1, 1, rows, cols);
    range.applyRowBanding(SpreadsheetApp.BandingTheme.TEAL); // Using Teal to match header

    // Header Style
    var headerRange = sheet.getRange(1, 1, 1, cols);
    headerRange.setFontWeight("bold")
        .setBackground("#009688") // Darker Teal
        .setFontColor("white")
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle")
        .setWrap(true);

    // Center Data Columns
    // All columns centered
    if (rows > 1) {
        sheet.getRange(2, 1, rows - 1, cols).setHorizontalAlignment("center");
    }

    // Autosize readable columns
    sheet.autoResizeColumns(1, 4);
}

function getSheetId() {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SHEET_ID');
    if (!id) {
        // If no ID found, create a NEW fallback sheet
        var ss = SpreadsheetApp.create("Warehouse_DB");
        id = ss.getId();
        props.setProperty('SHEET_ID', id);
        Logger.log("🆕 New Sheet Created: " + ss.getUrl());
    }
    return id;
}

function responseJSON(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
