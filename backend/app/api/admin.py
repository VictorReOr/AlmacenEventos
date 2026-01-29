from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict
from app.api.auth import get_current_user
from app.models.schemas import User, MovementProposal
from app.services.sheets_service import sheet_service
from app.models.schemas import ActionType, MaterialState # Helper imports if needed for reconstruction

router = APIRouter()

def require_admin(current_user: User):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

# --- PENDING ACTIONS ---

@router.get("/pending", response_model=List[Dict])
async def get_pending_actions(current_user: User = Depends(get_current_user)):
    require_admin(current_user)
    return sheet_service.get_pending_actions()

@router.post("/pending/{action_id}/approve")
async def approve_pending_action(action_id: str, current_user: User = Depends(get_current_user)):
    require_admin(current_user)
    
    # 1. Fetch Action
    action = sheet_service.get_pending_action(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
        
    if action["STATUS"] != "PENDING":
        raise HTTPException(status_code=400, detail="Action already processed")

    # 2. Parse Payload
    import json
    try:
        payload = json.loads(action["PAYLOAD_JSON"])
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to parse action payload: {e}")
         
    # 3. Execute
    requester = action["REQUESTER_EMAIL"]
    action_type = action.get("ACTION_TYPE", "MOVEMENT") # Fallback for backward compat if needed
    
    sheet_service.execute_transaction(action_type, payload, user_id=requester, transaction_id=f"TX-{action_id}")
    
    # 4. Remove from Pending (or mark Approved if we kept history, but plan said remove)
    sheet_service.delete_pending_action(action_id)
    
    return {"status": "APPROVED", "action_id": action_id}

@router.post("/pending/{action_id}/reject")
async def reject_pending_action(action_id: str, current_user: User = Depends(get_current_user)):
    require_admin(current_user)
    
    action = sheet_service.get_pending_action(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
        
    sheet_service.delete_pending_action(action_id)
    return {"status": "REJECTED", "action_id": action_id}

# --- USER MANAGEMENT ---

@router.get("/users", response_model=List[Dict])
async def get_users(current_user: User = Depends(get_current_user)):
    require_admin(current_user)
    users = sheet_service.get_users()
    # Clean up output if necessary (remove passwords)
    cleaned_users = []
    for u in users:
        # Handle potential key variations (USER_ID vs USER ID)
        email = u.get("USER_ID") or u.get("USER ID")
        if email:
            cleaned_users.append({
                "email": email,
                "role": u.get("ROLE", "VISITOR"),
                "name": u.get("NAME", "")
            })
    return cleaned_users

@router.put("/users/{email}/role")
async def update_user_role(email: str, new_role: str, current_user: User = Depends(get_current_user)):
    require_admin(current_user)
    
    # Validate role
    if new_role not in ["ADMIN", "USER", "VISITOR"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    try:
        sheet_service.update_user_role(email, new_role)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
        
    return {"status": "UPDATED", "email": email, "new_role": new_role}
