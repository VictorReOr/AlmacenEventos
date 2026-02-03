
import sys
import os
import asyncio
sys.path.append(os.getcwd())

from app.services.nlp_service import nlp_service
from app.services.sheets_service import sheet_service
from app.models.schemas import Interpretation

# Mocking the logic in api/assistant.py
def simulate_assistant_flow(text_to_process, user_query):
    print(f"--- Simulating Flow for: '{text_to_process}' ---")
    
    # 1. NLP
    print("1. Calling NLP Parse...")
    # Interpretation needs to be constructed manually if we don't mock the full parse return
    # But let's call nlp_service.parse directly if possible.
    # nlp_service.parse requires user_id.
    interpretation = nlp_service.parse(text_to_process, "test-user")
    print(f"   Intent Detected: {interpretation.intent}")
    
    # 2. Query Handling Logic (Copied from api/assistant.py)
    if interpretation.intent == "QUERY":
        print("2. Intent is QUERY. Starting Search...")
        
        all_items = sheet_service.get_inventory()
        print(f"   Fetched {len(all_items)} items.")
        
        found_items = []
        def normalize(s): return str(s).lower().strip()
        
        terms = normalize(text_to_process).split()
        
        for row in all_items:
            mat = normalize(row.get('MATERIAL', ''))
            stop_words = ["donde", "hay", "el", "la", "los", "las", "un", "una", "stock", "en", "de", "que"]
            search_keywords = [t for t in terms if t not in stop_words]
            
            if not search_keywords: continue
            
            if all(k in mat for k in search_keywords):
                found_items.append(row)
        
        print(f"   Found {len(found_items)} matches.")
        
        if found_items:
             total_qty = sum(int(i.get('CANTIDAD', 0)) for i in found_items if i.get('CANTIDAD').isdigit())
             locs = ", ".join(sorted(list(set(i.get('ID_UBICACION', '?') for i in found_items))))
             print(f"   Summary: Sí, hay {total_qty} unidades in {locs}")
        else:
             print("   Summary: No found.")
    
    print("--- Simulation Complete ---")

if __name__ == "__main__":
    simulate_assistant_flow("donde hay balones?", "balones")
