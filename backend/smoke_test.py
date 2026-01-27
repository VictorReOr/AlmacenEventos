import os
import sys
import json

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

def setup_env_early():
    # Load service account
    try:
        if os.path.exists("service_account.json"):
            with open("service_account.json", "r", encoding="utf-8") as f:
                creds_content = f.read()
                os.environ["GOOGLE_APPLICATION_CREDENTIALS_JSON"] = creds_content
                print("Loaded service_account.json into environment.")
        else:
             print("service_account.json not found in current directory.")
    except Exception as e:
        print(f"Error loading service account: {e}")

setup_env_early()

from app.services.sheets_service import SheetService
from app.core.config import get_settings

def run_test():
    print("Starting Smoke Test...")
    # Env already setup
    
    try:
        service = SheetService()
        service.connect()

        
        if service.client:
            print("Google Sheets API Auth Successful!")
        else:
            print("Auth Failed.")
            return

        if service.doc:
            print(f"Connected to Sheet: {service.doc.title}")
            print("Running read test (Cache refresh)...")
            service._refresh_location_cache()
            print(f"Cache refreshed. Found {len(service._valid_locations)} locations.")
        else:
            print("No Sheet opened (Check GOOGLE_SHEET_ID).")
            
    except Exception as e:
        print(f"Test crashed: {e}")

if __name__ == "__main__":
    run_test()
