import gspread
from google.oauth2.service_account import Credentials
import os
import sys

# SCOPES
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

LOC_CREDS = "service_account.json"
SHEET_ID = "1XCeV4S43BvwUen7h-0JU5kjOPk-MSzZ6vZDU4WLbTNE" # Default from code

def test():
    print(f"Current Dir: {os.getcwd()}")
    if not os.path.exists(LOC_CREDS):
        print(f"ERROR: {LOC_CREDS} not found in {os.getcwd()}")
        return

    try:
        print(f"Loading creds from {LOC_CREDS}...")
        creds = Credentials.from_service_account_file(LOC_CREDS, scopes=SCOPES)
        client = gspread.authorize(creds)
        
        print(f"Opening Sheet ID: {SHEET_ID}...")
        doc = client.open_by_key(SHEET_ID)
        print(f"SUCCESS! Sheet Title: {doc.title}")
        
        print("Available Worksheets:")
        for w in doc.worksheets():
            print(f" - {w.title}")
            
        print("Fetching USUARIOS...")
        ws_users = doc.worksheet("USUARIOS")
        users = ws_users.get_all_records()
        print(f"Users Found: {users}")

    except Exception as e:
        print(f"CRITICAL FAILURE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
