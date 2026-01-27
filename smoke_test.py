import os
import json
import gspread
from google.oauth2.service_account import Credentials
from google.cloud import vision

# CONFIG
SHEET_ID = "1XCeV4S43BvwUen7h-0JU5kjOPk-MSzZ6vZDU4WLbTNE"
CREDENTIALS_FILE = "backend/service_account.json"

def test_sheets():
    print("--- 1. Testing Google Sheets ---")
    try:
        if not os.path.exists(CREDENTIALS_FILE):
             print(f"FAIL: {CREDENTIALS_FILE} not found.")
             return False

        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
        client = gspread.authorize(creds)
        
        doc = client.open_by_key(SHEET_ID)
        print(f"SUCCESS: Connected to '{doc.title}'")
        
        worksheets = [ws.title for ws in doc.worksheets()]
        print(f"TABS FOUND: {worksheets}")
        return True
    except Exception as e:
        print(f"FAIL: Sheets Connection Error. {e}")
        return False

def test_vision():
    print("\n--- 2. Testing Google Vision (Dry Run) ---")
    try:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = CREDENTIALS_FILE
        client = vision.ImageAnnotatorClient()
        print("SUCCESS: Vision Client Initialized.")
        return True
    except Exception as e:
        print(f"FAIL: Vision Client Error. {e}")
        return False

if __name__ == "__main__":
    s = test_sheets()
    v = test_vision()
    
    if s and v:
        print("\n✅ SMOKE TEST PASSED: READY FOR DEPLOY")
    else:
        print("\n❌ SMOKE TEST FAILED: CHECK PERMISSIONS")
