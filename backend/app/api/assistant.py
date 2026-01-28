from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
import base64
from app.models.schemas import (
    AssistantParseRequest, AssistantParseResponse, 
    AssistantConfirmRequest, AssistantConfirmResponse,
    Interpretation, User, SubmitActionRequest
)
from app.services.nlp_service import nlp_service
from app.services.vision_service import vision_service
from app.services.validation_service import validation_service
from app.services.sheets_service import sheet_service
from app.core import security
from app.api.auth import get_current_user
import logging

router = APIRouter()
logger = logging.getLogger("assistant")

@router.post("/parse", response_model=AssistantParseResponse)
async def parse_request(
    request: AssistantParseRequest, 
    current_user: User = Depends(get_current_user)
):
    # 1. Input Processing
    text_to_process = request.text
    if request.image_base64:
        # TODO: Decode base64 and send to Vision
        pass

    # 2. NLP Analysis (Stateless)
    # Use authenticated user ID
    interpretation = nlp_service.parse(text_to_process, current_user.email)
    
    # 3. Validation
    warnings = validation_service.validate_proposal(interpretation.movements)
    
    # 4. Sign Proposal (JWT)
    token_payload = interpretation.dict()
    token = security.create_access_token(token_payload)

    return AssistantParseResponse(
        status="PROPOSAL_READY",
        interpretation=interpretation,
        warnings=warnings,
        token=token
    )

@router.post("/confirm", response_model=AssistantConfirmResponse)
async def confirm_request(
    request: AssistantConfirmRequest,
    current_user: User = Depends(get_current_user)
):
    # 1. Validate Token (Proposal Token)
    payload = security.verify_token(request.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired confirmation token")
    
    # 2. Reconstruct Proposal from Token
    try:
        # Rehydrate objects from payload
        interpretation = Interpretation(**payload)
        
        # 3. Role Based Execution
        if current_user.role == "VISITOR":
             raise HTTPException(status_code=403, detail="Visitors cannot execute actions.")
             
        elif current_user.role == "USER":
            # Queue for Approval
            action_id = sheet_service.add_pending_action(interpretation.movements, user_id=current_user.email)
            return AssistantConfirmResponse(
                status="PENDING_APPROVAL",
                transaction_id=action_id
            )
            
        elif current_user.role == "ADMIN":
            # Execute Immediately
            sheet_service.execute_transaction(interpretation.movements, user_id=current_user.email, transaction_id="TX-mock")
            
        else:
             raise HTTPException(status_code=403, detail="Unknown role permissions")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        return AssistantConfirmResponse(status="ERROR", error=str(e))
    
    return AssistantConfirmResponse(
        status="SUCCESS",
        transaction_id=f"TX-{hash(request.token)}",
        updated_balance={}
    )

@router.post("/submit_action")
async def submit_action(
    request: SubmitActionRequest,
    current_user: User = Depends(get_current_user)
):
    # Verify Role
    if current_user.role == "VISITOR":
         raise HTTPException(status_code=403, detail="Visitors cannot execute actions.")

    # USER -> Pending
    if current_user.role == "USER":
         action_id = sheet_service.add_pending_action(request.action_type, request.payload, user_id=current_user.email)
         return {
             "status": "PENDING_APPROVAL",
             "transaction_id": action_id
         }
    
    # ADMIN -> Execute
    if current_user.role == "ADMIN":
         # Execute immediately
         # We generate a mock transaction ID or real one if we had one
         tx_id = f"TX-ADM-{hash(str(request.payload))}"
         sheet_service.execute_transaction(request.action_type, request.payload, user_id=current_user.email, transaction_id=tx_id)
         return {
             "status": "SUCCESS",
             "transaction_id": tx_id
         }
    
    raise HTTPException(status_code=403, detail="Unknown role")

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Handle file upload for OCR.
    """
    try:
        contents = await file.read()
        # Convert to base64 for Vision Service
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        # Call Vision Service
        ocr_text = vision_service.detect_text(image_base64)
        
        return {
            "filename": file.filename,
            "ocr_text": ocr_text,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        return {
            "filename": file.filename,
            "ocr_text": "",
            "status": "error",
            "error": str(e)
        }
