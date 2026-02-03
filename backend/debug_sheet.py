
import sys
import os
sys.path.append(os.getcwd())

from app.services.sheets_service import sheet_service

def check_data():
    print("--- DIAGNOSTIC START ---")
    try:
        sheet_service.connect()
        print(f"Connected to Sheet ID: {sheet_service.doc.id}")
        
        ws = sheet_service.doc.worksheet("INVENTARIO")
        print("Worksheet 'INVENTARIO' found.")
        
        all_values = ws.get_all_values()
        print(f"Total Rows: {len(all_values)}")
        
        if all_values:
            print(f"Header Row (Raw): {all_values[0]}")
            
            # Test Internal Logic
            inv = sheet_service.get_inventory()
            print(f"Parsed Inventory Items: {len(inv)}")
            if inv:
                print(f"First Item: {inv[0]}")
            else:
                print("Parsed inventory is EMPTY.")
        else:
            print("Sheet is completely EMPTY.")

    except Exception as e:
        print(f"ERROR: {e}")
    print("--- DIAGNOSTIC END ---")

if __name__ == "__main__":
    check_data()
