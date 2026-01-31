from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.api.auth import get_current_user
from app.services.sheets_service import sheet_service
from app.models.schemas import User

router = APIRouter()

@router.get("/", response_model=List[Dict[str, Any]])
async def get_inventory(current_user: User = Depends(get_current_user)):
    """
    Get current inventory from Google Sheets.
    Returns a list of records (dicts).
    """
    # Optional: Restrict to authenticated users or specific roles if needed
    # For now, any logged-in user can view inventory
    inventory = sheet_service.get_inventory()
    if not inventory:
        # It might be empty or error, but we return empty list to not break frontend
        return []
    
    # DEBUG: Print first 3 items to check ID format
    if inventory:
        print(f"DEBUG INVENTORY SAMPLE (first 3): {[item.get('ID_UBICACION') for item in inventory[:3]]}")
    
    return inventory
