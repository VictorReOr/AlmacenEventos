from app.services.sheets_service import sheet_service

def test_availability():
    print("Testing Availability Logic...")
    try:
        candidates = sheet_service.get_available_locations(limit=5)
        print(f"Found {len(candidates)} candidates:")
        for c in candidates:
            print(f" - {c}")
            
        if not candidates:
            print("WARNING: No candidates found. Is the warehouse full or logic broken?")
        else:
            print("SUCCESS: Logic returned candidates.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_availability()
