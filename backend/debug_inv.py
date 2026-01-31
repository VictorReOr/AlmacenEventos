from app.services.sheets_service import sheet_service
import json

print("--- FETCHING INVENTORY ---")
try:
    inv = sheet_service.get_inventory()
    print(f"COUNT: {len(inv)}")
    if inv:
        print("SAMPLE ITEM 1:")
        print(json.dumps(inv[0], indent=2))
        print("SAMPLE IDs:")
        print([i.get("ID_UBICACION") for i in inv[:10]])
except Exception as e:
    print(e)
