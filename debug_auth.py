
import os
import json
import gspread
from google.oauth2.service_account import Credentials

# CONFIG
SHEET_ID = "1XCeV4S43BvwUen7h-0JU5kjOPk-MSzZ6vZDU4WLbTNE"
CREDENTIALS_FILE = "backend/service_account.json"

def debug_auth():
    print("--- DEBUGGING AUTHENTICATION DATA ---")
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"FAIL: {CREDENTIALS_FILE} not found.")
        return

    try:
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
        client = gspread.authorize(creds)
        
        doc = client.open_by_key(SHEET_ID)
        print(f"Connected to '{doc.title}'")
        
        try:
            ws = doc.worksheet("USUARIOS")
            print("Verified 'USUARIOS' tab exists.")
        except gspread.WorksheetNotFound:
            print("CRITICAL ERROR: 'USUARIOS' tab NOT FOUND.")
            print(f"Available tabs: {[ws.title for ws in doc.worksheets()]}")
            return

        # Fetch all records
        records = ws.get_all_records()
        print(f"Found {len(records)} user records.")
        
        if len(records) > 0:
            print("Headers detected based on first row keys:", list(records[0].keys()))
            
            print("\n--- User Dump (Passwords Masked) ---")
            for i, user in enumerate(records):
                # Display raw data for user verification
                print(f"Row {i+1}: {user}")
                
            # Check specifically for expected keys
            expected_keys = ["USER_ID", "ROLE", "NAME", "PASSWORD"]
            first_user = records[0]
            missing_keys = [k for k in expected_keys if k not in first_user]
            
            if missing_keys:
                print(f"\n❌ CRITICAL: Missing expected columns: {missing_keys}")
                print("The backend expects exactly: USER_ID, ROLE, NAME, PASSWORD")
            else:
                print(f"\n✅ All expected columns present.")
                
        else:
            print("⚠️ The USUARIOS tab is empty or only has headers.")
            headers = ws.row_values(1)
            print(f"Raw Header Row: {headers}")

    except Exception as e:
        print(f"FAIL: Error during debug. {e}")

if __name__ == "__main__":
    debug_auth()
