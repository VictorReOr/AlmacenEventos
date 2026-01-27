import os
import sys
import datetime
import gspread

# Add current directory to path
sys.path.append(os.getcwd())

from app.core.config import get_settings

def setup_sheets():
    print("Starting Google Sheets Setup/Migration...")
    
    # Manually load env just in case, though app.core.config should handle it if .env is present
    if os.path.exists(".env"):
        from dotenv import load_dotenv
        load_dotenv()

    settings = get_settings()
    
    if not settings.GOOGLE_APPLICATION_CREDENTIALS_JSON:
        # Fallback to local file if env var not set (development mode)
        if os.path.exists("service_account.json"):
            with open("service_account.json", "r", encoding="utf-8") as f:
                settings.GOOGLE_APPLICATION_CREDENTIALS_JSON = f.read()
        else:
            print("No credentials found.")
            return

    try:
        # Auth
        gc = gspread.service_account_from_dict(
            import_json_string(settings.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        )
        
        sheet_id = settings.GOOGLE_SHEET_ID
        if not sheet_id:
            print("No GOOGLE_SHEET_ID provided.")
            return

        doc = gc.open_by_key(sheet_id)
        print(f"Connected to Sheet: {doc.title}")

        # Define Schemas
        schemas = {
            "UBICACIONES": ["ID_UBICACION", "TIPO", "DESCRIPCION", "ZONA"],
            "INVENTARIO": ["ID_UBICACION", "MATERIAL", "CANTIDAD", "LOTE", "ESTADO", "RESPONSABLE"],
            "HISTORIAL": ["TIMESTAMP", "USUARIO", "ACCION", "MATERIAL", "CANTIDAD", "ORIGEN", "DESTINO", "MOTIVO"]
        }

        for sheet_name, headers in schemas.items():
            ensure_sheet(doc, sheet_name, headers)

        print("Sheet setup complete!")

    except Exception as e:
        print(f"Error during setup: {e}")

def import_json_string(json_str):
    import json
    return json.loads(json_str)

def ensure_sheet(doc, name, headers):
    try:
        # Get list of sheet titles
        worksheets = doc.worksheets()
        sheet_map = {ws.title.upper(): ws for ws in worksheets} # Upper -> WS object
        
        target_upper = name.upper()
        
        if target_upper in sheet_map:
            ws = sheet_map[target_upper]
            actual_title = ws.title
            
            # Rename if case mismatch (e.g. Inventario -> INVENTARIO)
            if actual_title != name:
                print(f"  Existing '{actual_title}' found. Renaming to '{name}'...")
                ws.update_title(name)
            else:
                print(f"  Existing '{name}' found.")
            
            # Check headers
            current_headers = ws.row_values(1)
            # If empty sheet, current_headers might be empty
            if not current_headers or current_headers != headers:
                print(f"  Headers mismatch (or empty) in '{name}'. Updating headers...")
                # print(f"     Old: {current_headers}")
                # print(f"     New: {headers}")
                
                ws.resize(rows=1000, cols=20) # Ensure size
                ws.update(range_name='A1', values=[headers])
                ws.format('1:1', {'textFormat': {'bold': True}})
                ws.freeze(rows=1)
                print("     Headers updated.")
            else:
                print("     Headers match.")
        else:
            print(f"  Creating new sheet '{name}'...")
            ws = doc.add_worksheet(title=name, rows=1000, cols=20)
            ws.update(range_name='A1', values=[headers])
            ws.format('1:1', {'textFormat': {'bold': True}})
            ws.freeze(rows=1)
            print("  Created.")

    except Exception as e:
        print(f"  Error processing '{name}': {e}")

if __name__ == "__main__":
    setup_sheets()
