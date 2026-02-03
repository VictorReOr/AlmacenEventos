import spacy
import re
from typing import List, Dict, Tuple, Optional
from app.models.schemas import MovementProposal, ActionType, MaterialState, Interpretation
from app.core.config import get_settings

settings = get_settings()

class NLPService:
    def __init__(self):
        try:
            self.nlp = spacy.load("es_core_news_lg")
            print("NLP: spaCy model loaded successfully.")
        except OSError:
            print("NLP: spaCy model not found. Running in regex-only fallback mode.")
            self.nlp = None

    def _extract_locations(self, text: str) -> List[str]:
        """Extract warehouse locations using regex patterns."""
        patterns = [
            r"E\d+-M\d+-A\d+",  # E1-M1-A1
            r"P-\d+",           # P-01
            r"RECEPCION",
            r"EXTERNO",
            r"MUELLE"
        ]
        locations = []
        for pat in patterns:
            locations.extend(re.findall(pat, text, re.IGNORECASE))
        return [l.upper() for l in locations]

    def _extract_quantities(self, doc) -> List[int]:
        """Extract numeric quantities from spaCy doc."""
        if not doc:
            return []
        quantities = []
        for token in doc:
            if token.like_num:
                try:
                    quantities.append(int(token.text))
                except ValueError:
                    pass
        return quantities

    def _extract_materials(self, doc, text: str) -> List[str]:
        """Extract material names using spaCy nouns and context."""
        if not doc:
            # Fallback: extract words between quantity and location
            return ["material"]
        
        materials = []
        # Look for nouns that could be materials
        for token in doc:
            if token.pos_ in ["NOUN", "PROPN"] and token.text.lower() not in [
                "recepcion", "muelle", "almacen", "entrada", "salida"
            ]:
                materials.append(token.text)
        
        # If we found materials, join them into a phrase
        if materials:
            return [" ".join(materials)]
        
        return ["material"]

    def _extract_verbs(self, doc) -> List[str]:
        """Extract action verbs and their lemmas."""
        if not doc:
            return []
        verbs = []
        for token in doc:
            if token.pos_ == "VERB":
                verbs.append(token.lemma_.lower())
        return verbs

    def _detect_intent(self, text: str, verbs: List[str]) -> str:
        """Detect intent using verb analysis and keywords."""
        text_lower = text.lower()
        print(f"NLP Analysis: Text='{text_lower}', Verbs={verbs}")
        
        # Check for inventory queries - PRIORITY
        query_words = ["donde", "dónde", "hay", "buscar", "encuentra", "tienes", "stock", "quedan", "ver", "listar"]
        is_query = any(w in text_lower for w in query_words)
        
        if is_query and ("?" in text or any(w in text_lower for w in ["dónde", "donde está", "donde hay", "hay un", "hay una"])):
            print("NLP: Detected QUERY (Strong match)")
            return "QUERY"
        
        # Check for greetings
        greetings = ["hola", "buenos días", "buenas tardes", "buenas noches", "hey", "saludos"]
        if any(g in text_lower for g in greetings):
            return "GREETING"
        
        # Check for thanks/goodbye
        if any(w in text_lower for w in ["gracias", "adiós", "hasta luego", "chao"]):
            return "COURTESY"

        # Analyze verbs for warehouse actions
        entrada_verbs = ["llegar", "entrar", "recibir", "ingresar", "registrar"]
        salida_verbs = ["sacar", "salir", "enviar", "despachar", "retirar"]
        movimiento_verbs = ["mover", "trasladar", "cambiar", "reubicar", "pasar"]
        
        if any(v in verbs for v in entrada_verbs) or any(w in text_lower for w in ["llegado", "entrada", "alta"]):
            return "ENTRADA"
        if any(v in verbs for v in salida_verbs) or any(w in text_lower for w in ["salida", "cliente"]):
            return "SALIDA"
        if any(v in verbs for v in movimiento_verbs) or any(w in text_lower for w in ["movimiento"]):
            return "MOVIMIENTO"
        
        # Fallback for Query (weak match)
        if is_query:
             print("NLP: Detected QUERY (Weak match)")
             return "QUERY"

        print("NLP: Detected UNKNOWN")
        return "UNKNOWN"

    def _build_movements(
        self, 
        intent: str, 
        quantities: List[int], 
        materials: List[str], 
        locations: List[str]
    ) -> List[MovementProposal]:
        """Build movement proposals based on extracted entities."""
        movements = []
        
        if intent == "QUERY":
             # Create a dummy movement to carry the material info if needed
             item = materials[0] if materials else "material"
             movements.append(MovementProposal(
                item=item,
                qty=0,
                origin="SEARCH",
                destination="RESULT",
                type=ActionType.MOVIMIENTO # Dummy type
            ))
             return movements

        if intent == "ENTRADA":
            qty = quantities[0] if quantities else 1
            item = materials[0] if materials else "material"
            destination = locations[0] if locations else "RECEPCION"
            
            movements.append(MovementProposal(
                item=item,
                qty=qty,
                origin="EXTERNO",
                destination=destination,
                type=ActionType.ENTRADA
            ))
        
        elif intent == "SALIDA":
             # ... existing logic ...
             qty = quantities[0] if quantities else 1
             item = materials[0] if materials else "material"
             origin = locations[0] if locations else "RECEPCION"
             
             movements.append(MovementProposal(
                 item=item,
                 qty=qty,
                 origin=origin,
                 destination="EXTERNO",
                 type=ActionType.SALIDA
             ))

        elif intent == "MOVIMIENTO":
            qty = quantities[0] if quantities else 1
            item = materials[0] if materials else "material"
            
            if len(locations) >= 2:
                origin = locations[0]
                destination = locations[1]
            elif len(locations) == 1:
                origin = locations[0]
                destination = "RECEPCION"
            else:
                origin = "RECEPCION"
                destination = "RECEPCION"
            
            movements.append(MovementProposal(
                item=item,
                qty=qty,
                origin=origin,
                destination=destination,
                type=ActionType.MOVIMIENTO
            ))
        
        return movements

    def _generate_summary(self, intent: str, movements: List[MovementProposal]) -> str:
        """Generate a human-readable summary."""
        if intent == "GREETING":
            return "¡Hola! ¿En qué puedo ayudarte hoy?"
        
        if intent == "COURTESY":
            return "¡De nada! Estoy aquí cuando me necesites."
        
        if intent == "QUERY":
            return "Consultando inventario..."

        if intent == "UNKNOWN":
            return "No he entendido el comando. Intenta con 'llegado material', 'mover caja', o 'salida de unidades'."
        
        if not movements:
            return f"He detectado una intención de {intent}, pero no pude extraer los detalles necesarios."
        
        mov = movements[0]
        if intent == "ENTRADA":
            return f"Registrar entrada de {mov.qty} unidad(es) de '{mov.item}' en {mov.destination}"
        elif intent == "SALIDA":
            return f"Registrar salida de {mov.qty} unidad(es) de '{mov.item}' desde {mov.origin}"
        elif intent == "MOVIMIENTO":
            return f"Mover {mov.qty} unidad(es) de '{mov.item}' desde {mov.origin} hasta {mov.destination}"
        
        return f"Operación de {intent} detectada con {len(movements)} movimiento(s)"

    def parse(self, text: str, user_id: str) -> Interpretation:
        """Parse user input and extract structured information."""
        # 1. NLP Processing with spaCy
        doc = self.nlp(text) if self.nlp else None
        
        # 2. Entity Extraction
        locations = self._extract_locations(text)
        quantities = self._extract_quantities(doc)
        materials = self._extract_materials(doc, text)
        verbs = self._extract_verbs(doc)
        
        # 3. Intent Detection
        intent = self._detect_intent(text, verbs)
        
        # 4. Build Movement Proposals
        movements = self._build_movements(intent, quantities, materials, locations)
        
        # 5. Generate Summary
        summary = self._generate_summary(intent, movements)
        
        return Interpretation(
            intent=intent,
            summary=summary,
            movements=movements
        )

nlp_service = NLPService()
