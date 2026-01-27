from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import (
    AssistantParseRequest, AssistantParseResponse, 
    AssistantConfirmRequest, AssistantConfirmResponse,
    Interpretation
)
from app.services.nlp_service import nlp_service
from app.services.vision_service import vision_service
from app.services.validation_service import validation_service
from app.services.sheets_service import sheet_service # For execution
from app.core import security
import logging

router = APIRouter()
logger = logging.getLogger("assistant")

@router.post("/parse", response_model=AssistantParseResponse)
async def parse_request(request: AssistantParseRequest):
    # 1. Input Processing (OCR or Text)
    text_to_process = request.text
    if request.image_base64:
        # TODO: Decode base64 and send to Vision
        # text_from_ocr = vision_service.detect_text(decoded_image)
        pass

    # 2. NLP Analysis (Stateless)
    interpretation = nlp_service.parse(text_to_process, request.user_id)
    
    # 3. Validation
    warnings = validation_service.validate_proposal(interpretation.movements)
    
    # 4. Sign Proposal (JWT)
    # We include the FULL interpretation in the token to ensure statelessness
    token_payload = interpretation.dict()
    token = security.create_access_token(token_payload)

    return AssistantParseResponse(
        status="PROPOSAL_READY",
        interpretation=interpretation,
        warnings=warnings,
        token=token
    )

@router.post("/confirm", response_model=AssistantConfirmResponse)
async def confirm_request(request: AssistantConfirmRequest):
    # 1. Validate Token
    payload = security.verify_token(request.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired confirmation token")
    
    # 2. Reconstruct Proposal from Token (Stateless)
    # The payload essentially IS the interpretation
    # We might want to re-validate stock here if time passed?
    
    # 3. Execute
    try:
        # data = Interpretation(**payload)
        # sheet_service.execute_transaction(data.movements, user=request.user_id)
        pass
    except Exception as e:
        return AssistantConfirmResponse(status="ERROR", error=str(e))
    
    return AssistantConfirmResponse(
        status="SUCCESS",
        transaction_id=f"TX-{hash(request.token)}", # Mock
        updated_balance={}
    )
