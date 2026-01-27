from typing import List, Optional
from app.models.schemas import MovementProposal
from app.services.sheets_service import sheet_service

class ValidationService:
    def validate_proposal(self, movements: List[MovementProposal]) -> List[str]:
        warnings = []
        # 1. Validate Locations
        for mov in movements:
            if mov.origin != "EXTERNO" and not sheet_service.validate_location(mov.origin):
                 # Critical Block? Spec says "Parse blocks if location does not exist"
                 # But we might return it as a structured error in the response instead of 500
                 pass # TODO: Raise error or handled upstream
            
            if mov.destination != "EXTERNO" and not sheet_service.validate_location(mov.destination):
                 pass

        return warnings

validation_service = ValidationService()
