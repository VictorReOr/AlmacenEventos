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
            r"MUELLE",
            # Natural language mappings
            r"palet\s*[-#]?\s*(\d+)",
            r"estanter[iía]\s*(\d+)",
        ]
        locations = []
        for pat in patterns:
            param_matches = re.finditer(pat, text, re.IGNORECASE)
            for match in param_matches:
                full_str = match.group(0)
                
                # Handle capture groups for "palet 17" -> "P-17"
                if len(match.groups()) > 0 and match.group(1):
                    val = match.group(1)
                    if "palet" in full_str.lower():
                        locations.append(f"P-{val}")
                    elif "estanter" in full_str.lower():
                        locations.append(f"E{val}") # Assuming E1, E2... usually just shelf ID. Refine if needed.
                else:
                    locations.append(full_str.upper())
                    
        return list(set([l.upper() for l in locations])) # Dedupe

    def _extract_quantities(self, doc, text: str) -> List[int]:
        """Extract numeric quantities from spaCy doc and text."""
        quantities = []
        
        # 1. Explicit word numbers
        text_lower = text.lower()
        if re.search(r"\b(un|una|uno)\b", text_lower): # un, una, uno
             quantities.append(1)

        if not doc:
             # Fallback regex for digits
             nums = re.findall(r"\b\d+\b", text)
             return [int(n) for n in nums] + quantities

        for token in doc:
            if token.like_num:
                try:
                    val = int(token.text)
                    quantities.append(val)
                except ValueError:
                    # Try to convert word to num if needed (uno, dos...) - spacy usually handles this somewhat
                    if token.text.lower() in ["un", "una", "uno"]:
                        quantities.append(1)
                    pass
        
        return list(set(quantities))

    def _extract_materials(self, doc, text: str, locations: List[str]) -> List[str]:
        """Extract material names using spaCy nouns and context, REMOVING detected locations first."""
        
        # Clean text of known locations to avoid "palet 17" being "material palet"
        clean_text = text
        # We need to re-find the raw strings for locations to remove them
        # Simple approach: Remove the patterns we know
        patterns_to_remove = [
             r"E\d+-M\d+-A\d+", 
             r"P-\d+", 
             r"RECEPCION", r"EXTERNO", r"MUELLE",
             r"palet\s*[-#]?\s*\d+",
             r"estanter[iía]\s*\d+",
             r"\bdep\b", r"\bde\b" # remove prepositions often linking items
        ]
        
        for pat in patterns_to_remove:
            clean_text = re.sub(pat, " ", clean_text, flags=re.IGNORECASE)
            
        # Also remove numbers that were identified as quantities? 
        # Ideally yes, but let's stick to doc analysis on the CLEANED text
        
        doc_clean = self.nlp(clean_text) if self.nlp else None
        
        if not doc_clean:
            return ["material"]
        
        materials = []
        # Look for nouns that could be materials
        for token in doc_clean:
            if token.pos_ in ["NOUN", "PROPN"] and token.text.lower() not in [
                "recepcion", "muelle", "almacen", "entrada", "salida", "caja", "unidades", "unidad", "zona", "sitio", "lugar"
            ]:
                materials.append(token.text)
        
        # If we found materials, join them into a phrase
        if materials:
            return [" ".join(materials)]
        
        # Fallback if cleaning stripped everything
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
        query_words = ["donde", "dónde", "hay", "buscar", "encuentra", "tienes", "stock", "quedan", "ver", "listar", "dime", "cual", "cuál", "que", "qué", "info", "detalle"]
        is_query = any(w in text_lower for w in query_words)
        
        # Strong match patterns (Question marks or explicit phrases)
        strong_patterns = [
            "dónde", "donde está", "donde esta", "donde hay", "hay un", "hay una",
            "en que", "en qué", "que hay", "qué hay", "cual es", "cuál es",
            "en que modulo", "en qué módulo", "en que estanteria", "en qué estantería"
        ]
        
        if "?" in text or any(p in text_lower for p in strong_patterns):
            # Exception: "Quiero saber donde esta..." -> Query
            # But "Ponlo donde hay sitio" -> Movement (complex).
            # Assume Query for now if strong match.
            print("NLP: Detected QUERY (Strong match)")
            return "QUERY"
        
        # Check for greetings (if not a query)
        greetings = ["hola", "buenos días", "buenas tardes", "buenas noches", "hey", "saludos"]
        if any(g in text_lower for g in greetings) and not is_query:
            return "GREETING"
        
        # Check for thanks/goodbye
        if any(w in text_lower for w in ["gracias", "adiós", "hasta luego", "chao", "genial", "perfecto", "vale"]):
            return "COURTESY"

        # Analyze verbs for warehouse actions
        entrada_verbs = ["llegar", "entrar", "recibir", "ingresar", "registrar", "traer", "meter"]
        salida_verbs = ["sacar", "salir", "enviar", "despachar", "retirar", "llevar"]
        movimiento_verbs = ["mover", "trasladar", "cambiar", "reubicar", "pasar", "poner", "colocar", "dejar"]
        
        if any(v in verbs for v in entrada_verbs) or any(w in text_lower for w in ["llegado", "entrada", "alta", "nueva codigo"]):
             # Explicit override: "Quiero colocar..." is usually movement, but "Ha llegado... y quiero colocar" is Entry.
             # If "llegado" is present, it's likely an Entry.
             return "ENTRADA"
            
        if any(v in verbs for v in salida_verbs) or any(w in text_lower for w in ["salida", "cliente", "baja"]):
            return "SALIDA"
            
        if any(v in verbs for v in movimiento_verbs) or any(w in text_lower for w in ["movimiento", "cambio"]):
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
        
        # Default Logic
        qty = quantities[0] if quantities else 1
        item = materials[0] if materials else "material"
        
        # Refine destinations/origins based on what we found
        # Example: "Palet 17" found in text
        found_target_loc = None
        found_source_loc = None
        
        # Heuristic: If 2 locations, usually Origin -> Dest.
        # If 1 location:
        #   ENTRADA -> Dest
        #   SALIDA -> Origin
        #   MOVIMIENTO -> Dest (Origin assumed implicit or currently held?) -> usually Origin->Dest needed.
        #      If only 1 loc in Mov, assume Dest? "Mover a Palet 1". Origin = ? (Search?).
        
        if len(locations) >= 2:
            found_source_loc = locations[0]
            found_target_loc = locations[1]
        elif len(locations) == 1:
            if intent == "ENTRADA": found_target_loc = locations[0]
            elif intent == "SALIDA": found_source_loc = locations[0]
            elif intent == "MOVIMIENTO": found_target_loc = locations[0] # "Mover a X"
        
        if intent == "QUERY":
             movements.append(MovementProposal(
                item=item,
                qty=0,
                origin="SEARCH",
                destination="RESULT",
                type=ActionType.MOVIMIENTO
            ))
             return movements

        if intent == "ENTRADA":
            destination = found_target_loc if found_target_loc else "RECEPCION"
            movements.append(MovementProposal(
                item=item,
                qty=qty,
                origin="EXTERNO",
                destination=destination,
                type=ActionType.ENTRADA
            ))
        
        elif intent == "SALIDA":
             origin = found_source_loc if found_source_loc else "RECEPCION" # Or Search?
             movements.append(MovementProposal(
                 item=item,
                 qty=qty,
                 origin=origin,
                 destination="EXTERNO",
                 type=ActionType.SALIDA
             ))

        elif intent == "MOVIMIENTO":
            # If we don't know origin, strictly we should fail or ask. 
            # But for now, default to RECEPCION if unknown? Or better, "UNKNOWN".
            origin = found_source_loc if found_source_loc else "RECEPCION"
            destination = found_target_loc if found_target_loc else "RECEPCION"
            
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
        quantities = self._extract_quantities(doc, text)
        materials = self._extract_materials(doc, text, locations)
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
