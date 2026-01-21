
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

function handleRequest(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(30000); // Wait up to 30s

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
                ubicaciones: data.ubicaciones,
                geometry: data.geometry
            });
        }

    } catch (err) {
        return responseJSON({ status: 'error', message: err.toString() + " Stack: " + err.stack });
    } finally {
        lock.releaseLock();
    }
}

// --- SAVING LOGIC ---
function saveData(ss, payload) {
    // 1. Save Geometry & Config to 'Config' Sheet
    var configSheet = ensureSheet(ss, 'Config');
    configSheet.clear(); // Clear old config
    configSheet.getRange("A1").setValue("Geometry_JSON");
    configSheet.getRange("B1").setValue(JSON.stringify(payload.geometry || []));

    // 2. Save Ubicaciones to 'Inventario' Sheet (Structured)
    var invSheet = ensureSheet(ss, 'Inventario');
    invSheet.clear(); // Clear all old data AND formats

    // Headers
    var headers = ["ID", "Contenido", "Programa", "Tipo", "X", "Y", "Rotation", "Width", "Depth", "Detalles_JSON"];
    invSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    var rows = [];
    var ubis = payload.ubicaciones || {};

    // Sort for logical order (Numeric IDs first, then Alpha)
    var sortedKeys = Object.keys(ubis).sort(function (a, b) {
        var numA = parseInt(a);
        var numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    sortedKeys.forEach(function (key) {
        var u = ubis[key];
        // Create Row: ID | Contenido | Programa | Tipo | X | Y | Rot | W | D | JSON
        rows.push([
            u.id,
            u.contenido || "",
            u.programa || "Vacio",
            u.tipo,
            Math.round(u.x * 100) / 100, // Round to 2 decimals for readability
            Math.round(u.y * 100) / 100,
            u.rotation,
            u.width,
            u.depth,
            JSON.stringify(u) // Store full object to preserve complex data (like shelf levels)
        ]);
    });

    if (rows.length > 0) {
        invSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // Apply Formatting AFTER saving
    formatInventorySheet(invSheet);
}

// --- LOADING LOGIC ---
function loadData(ss) {
    // 1. Load Geometry
    var configSheet = ss.getSheetByName('Config');
    var geometry = [];
    if (configSheet) {
        var geoJson = configSheet.getRange("B1").getValue();
        if (geoJson) geometry = JSON.parse(geoJson);
    }

    // 2. Load Ubicaciones
    var invSheet = ss.getSheetByName('Inventario');
    var ubicaciones = {};

    if (invSheet && invSheet.getLastRow() > 1) {
        var data = invSheet.getRange(2, 1, invSheet.getLastRow() - 1, 10).getValues();

        data.forEach(function (row) {
            // Row Map: 0:ID, 1:Cont, 2:Prog, 3:Tipo, 4:X, 5:Y, 6:Rot, 7:W, 8:D, 9:JSON
            var id = String(row[0]);
            if (!id) return;

            // Prefer the JSON source for structural integrity, but override with Sheet edits
            var u = {};
            try {
                u = JSON.parse(row[9]);
            } catch (e) {
                // Fallback if JSON broken (manual row add?)
                u = { id: id, tipo: row[3] || 'palet' };
            }

            // Sync editable fields
            u.id = id;
            u.contenido = String(row[1]);
            u.programa = String(row[2]);
            // Technical fields (X,Y) usually controlled by App, but if User edits them manually we respect it
            u.x = Number(row[4]);
            u.y = Number(row[5]);
            u.rotation = Number(row[6]);

            ubicaciones[id] = u;
        });
    }

    return { ubicaciones: ubicaciones, geometry: geometry };
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
    var sheetId = getSheetId();
    var ss = SpreadsheetApp.openById(sheetId);
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
    // ID (1), Programa (3), Tipo (4), Coords (5-9)
    if (rows > 1) {
        sheet.getRange(2, 1, rows - 1, 1).setHorizontalAlignment("center");
        sheet.getRange(2, 4, rows - 1, 6).setHorizontalAlignment("center");
    }

    // Autosize readable columns
    sheet.autoResizeColumns(1, 4);
}

function getSheetId() {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SHEET_ID');
    if (!id) {
        var ss = SpreadsheetApp.create("Warehouse_DB");
        id = ss.getId();
        props.setProperty('SHEET_ID', id);
        Logger.log("🆕 New Sheet Created: " + ss.getUrl());
    } else {
        try {
            var ss = SpreadsheetApp.openById(id);
            Logger.log("ℹ️ Using Existing Sheet: " + ss.getUrl());
        } catch (e) {
            Logger.log("⚠️ Stored Sheet ID invalid. Clearing property.");
            props.deleteProperty('SHEET_ID');
            return getSheetId(); // Retry
        }
    }
    return id;
}

function responseJSON(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
