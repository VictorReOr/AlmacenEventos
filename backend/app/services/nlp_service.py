import spacy
import re
from typing import List, Dict, Tuple
from app.models.schemas import MovementProposal, ActionType, MaterialState, Interpretation
from app.core.config import get_settings

settings = get_settings()

class NLPService:
    def __init__(self):
        try:
            self.nlp = spacy.load("es_core_news_lg")
            print("NLP: Model loaded.")
        except OSError:
            print("NLP: Model not found. Running in regex-only fallback mode.")
            self.nlp = None

    def _extract_locations(self, text: str) -> List[str]:
        # Regex for standard location E#-M#-A# or P-# or RECEPTION
        # Matches E1-M1-A1, P-01, RECEPCION
        patterns = [
            r"E\d+-M\d+-A\d+", # E1-M1-A1
            r"P-\d+",          # P-01
            r"RECEPCION", 
            r"EXTERNO",
            r"MUELLE"
        ]
        locations = []
        for pat in patterns:
            locations.extend(re.findall(pat, text, re.IGNORECASE))
        return [l.upper() for l in locations]

    def _extract_intent(self, text: str) -> str:
        text_lower = text.lower()
        if any(w in text_lower for w in ["llegado", "entrando", "recibido", "alta"]):
            return "INBOUND"
        if any(w in text_lower for w in ["sacar", "salida", "enviado", "cliente"]):
            return "OUTBOUND"
        if any(w in text_lower for w in ["mover", "cambiar", "reubicar"]):
            return "INTERNAL_MOVE"
        return "UNKNOWN"

    def parse(self, text: str, user_id: str) -> Interpretation:
        # 1. NLP Processing
        doc = self.nlp(text) if self.nlp else None
        
        # 2. Entity Extraction
        # TODO: Improve with trained NER. For now, heuristics + Spacy
        
        intent = self._extract_intent(text)
        locations = self._extract_locations(text)
        
        # Mock Logic for Prototyping (as per Phase 1 strictness requirements, we need logic)
        # Assuming format: "Item X qty Y to Location Z"
        
        movements: List[MovementProposal] = []
        
        # VERY BASIC PARSING LOGIC (Placeholder for advanced deterministic engine)
        # If "llegado" -> Origin is EXTERNAL
        if intent == "INBOUND":
             # Try to find a number
             qty = 0
             for token in doc:
                 if token.like_num:
                     try:
                         qty = int(token.text)
                     except: 
                         pass
             
             # Fallback location
             dest = locations[0] if locations else "RECEPCION"
             
             movements.append(MovementProposal(
                 item="MATERIAL_DETECTED", # TODO: Extract actual material name
                 qty=qty,
                 origin="EXTERNO",
                 destination=dest,
                 type=ActionType.ENTRADA
             ))

        return Interpretation(
            intent=intent,
            summary=f"Intent detected: {intent}. Found {len(movements)} movements.",
            movements=movements
        )

nlp_service = NLPService()
