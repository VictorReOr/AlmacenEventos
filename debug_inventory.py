
import sys
import os
import asyncio
# Add backend to path to allow imports
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.sheets_service import sheet_service

def debug_sheet():
    print("--- STARTING DEBUG ---")
    try:
        inventory = sheet_service.get_inventory()
        print(f"Total items fetched: {len(inventory)}")
        if inventory:
            print("First item keys:", inventory[0].keys())
            print("First item sample:", inventory[0])
            
            # Check for specific column
            has_type = any("TIPO_DE_CONTENEDOR" in item for item in inventory)
            has_type_spaces = any("TIPO DE CONTENEDOR" in item for item in inventory)
            print(f"Has 'TIPO_DE_CONTENEDOR': {has_type}")
            print(f"Has 'TIPO DE CONTENEDOR': {has_type_spaces}")
        else:
            print("Inventory list is empty.")
    except Exception as e:
        print(f"ERROR: {e}")
    print("--- END DEBUG ---")

if __name__ == "__main__":
    debug_sheet()
