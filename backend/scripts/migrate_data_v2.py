
import gspread
import re
import os
import sys
from google.oauth2.service_account import Credentials

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# SCOPES and ID
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1XCeV4S43BvwUen7h-0JU5kjOPk-MSzZ6vZDU4WLbTNE"

def migrate_to_split_schema():
    print("🚀 Iniciando migración de datos a Esquema V2 (Desglosado)...")
    
    # Authenticate
    creds_path = os.path.join(os.path.dirname(__file__), '..', 'service_account.json')
    if not os.path.exists(creds_path):
        print(f"❌ No se encontró service_account.json en {creds_path}")
        return

    creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
    client = gspread.authorize(creds)
    
    try:
        doc = client.open_by_key(SHEET_ID)
        ws = doc.worksheet("INVENTARIO")
    except Exception as e:
        print(f"❌ Error conectando: {e}")
        return

    # Read all data
    rows = ws.get_all_values()
    if len(rows) < 2:
        print("⚠️ No hay datos para migrar.")
        return

    headers = rows[0]
    data_rows = rows[1:]
    
    updates = []
    
    print(f"🔍 Analizando {len(data_rows)} filas...")

    for i, row in enumerate(data_rows):
        row_num = i + 2 # 1-based index + header
        
        # Get raw values (pad if necessary)
        # Expected V2 Layout:
        # A: ID, B: TIPO, C: LUGAR, D: MOD, E: ALT, F: ...
        
        val_a = row[0] if len(row) > 0 else "" # ID_REGISTRO
        val_b = row[1] if len(row) > 1 else "" # TIPO (or old UBICACION)
        
        # We look for the pattern in A or B
        source_str = ""
        if "E" in val_b and "-" in val_b: source_str = val_b
        elif "E" in val_a and "-" in val_a: source_str = val_a
        elif val_b.isdigit(): source_str = val_b # Pallet ID in B
        elif val_a.isdigit(): source_str = val_a # Pallet ID in A? (Risk of conflict with ID_REGISTRO 1,2,3)
        
        # PATTERN MATCHING
        
        # 1. SHELF: E1-M2-A1
        match = re.match(r"^(E\d+)-M(\d+)-A(\d+)$", source_str, re.IGNORECASE)
        
        new_row = [x for x in row] # Copy
        # Extend if short
        while len(new_row) < 12: new_row.append("")

        migrated = False

        if match:
            # Found Combined String!
            # Extract
            lugar = match.group(1) # E1
            mod = match.group(2)   # 2
            alt = match.group(3)   # 1
            
            # Update Columns
            new_row[1] = "estanteria" # B: TIPO_UBICACION
            new_row[2] = lugar        # C: ID_LUGAR
            new_row[3] = mod          # D: MODULO
            new_row[4] = alt          # E: ALTURA
            
            print(f"   ✅ Fila {row_num}: Convertido '{source_str}' -> Estantería {lugar} M{mod} A{alt}")
            migrated = True

        elif re.match(r"^(E\d+)$", source_str, re.IGNORECASE):
            # Just E1? Maybe legacy shelf header, ignore or fix?
            pass

        elif source_str.isdigit() or val_b.lower() == 'palet':
            # PALLET Logic
            # If B was "1" (old location) or A was "1" (and user said 'from id_registro')
            # Assuming 'source_str' captured the pallet ID.
            # Warning: ID_REGISTRO (A) might look like '1'. Check if it's meant to be location.
            # If B is empty, maybe A is location? 
            # Let's assume if we found a source_str digit that clearly isn't just a row index...
            # Actually, standard pallet IDs are 1-67.
            
            # Simple heuristic: If B is old schema, B held the ID.
            # Use B if not empty.
            pallet_id = val_b if val_b else val_a
            
            # Avoid overwriting metadata rows or if it's already correct
            if pallet_id and pallet_id.isdigit():
                 new_row[1] = "palet"    # B
                 new_row[2] = pallet_id  # C
                 new_row[3] = ""         # D
                 new_row[4] = ""         # E
                 # print(f"   ✅ Fila {row_num}: Convertido '{pallet_id}' -> Palet")
                 migrated = False # Don't spam console for simple pallets unless sure

        if migrated:
            updates.append({
                "range": f"B{row_num}:E{row_num}",
                "values": [[new_row[1], new_row[2], new_row[3], new_row[4]]]
            })

    if updates:
        print(f"💾 Aplicando {len(updates)} cambios...")
        # batch_update is cleaner but update per row is easier to implement quickly with gspread range
        # Let's use batch_update logic if possible, or just loop updates (slow but safe)
        for up in updates:
            ws.update(up['range'], up['values'])
        print("🎉 Migración completada!")
    else:
        print("✨ No se encontraron patrones 'E*-M*-A*' para expandir.")

if __name__ == "__main__":
    migrate_to_split_schema()
