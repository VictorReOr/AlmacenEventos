from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import (
    AssistantParseRequest, AssistantParseResponse, 
    AssistantConfirmRequest, AssistantConfirmResponse,
    Interpretation, User
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
        
        # 3. Execute
        sheet_service.execute_transaction(interpretation.movements, user_id=current_user.email, transaction_id="TX-mock")
        
    except Exception as e:
        return AssistantConfirmResponse(status="ERROR", error=str(e))
    
    return AssistantConfirmResponse(
        status="SUCCESS",
        transaction_id=f"TX-{hash(request.token)}",
        updated_balance={}
    )
