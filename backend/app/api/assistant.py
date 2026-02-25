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

    # --- LOCATION SUGGESTION LOGIC ---
    if interpretation.intent == "ENTRADA":
        for mov in interpretation.movements:
            # If NLP defaulted to RECEPCION, it means user didn't specify destination
            if mov.destination == "RECEPCION":
                print("ASSISTANT: No destination specified for ENTRADA. Finding suggestions...")
                candidates = sheet_service.get_available_locations(limit=3)
                
                if candidates:
                    # Suggest the first one
                    best_option = candidates[0]
                    mov.destination = best_option
                    
                    # Improve Summary
                    others = ", ".join(candidates[1:])
                    msg = f"He encontrado hueco en {best_option}."
                    if others:
                        msg += f" Otras opciones: {others}."
                    msg += " ¿Confirmas?"
                    interpretation.summary = msg
                else:
                    interpretation.summary = "No he encontrado huecos libres automáticamente. Por favor, indica dónde guardarlo."

    # --- QUERY HANDLING ---
    if interpretation.intent == "QUERY":
        try:
            print(f"ASSISTANT: Handling QUERY for '{text_to_process}'")
            all_items = sheet_service.get_inventory()
            found_items = []
            
            print(f"ASSISTANT: Querying inventory. Total items available: {len(all_items)}")
            
            def normalize(s): 
                return str(s).lower().strip()
            
            user_query = normalize(text_to_process)
            
            # --- NLP SANITIZATION ---
            # Remove punctuation to avoid keywords failing to match (e.g. "cuadernos??" -> "cuadernos")
            import string
            for p in string.punctuation + "¿¡":
                user_query = user_query.replace(p, '')
            
            # --- SMART PRE-PROCESSING ---
            # Handle "Estantería X" -> "EX" conversion
            import re
            
            # Pattern: "estanteria" followed with optional space and a number/letter
            # e.g. "estanteria 1" -> "E1", "estanteria B" -> "EB"
            shelf_match = re.search(r'estanter[ií]a\s*(\w+)', user_query)
            # Variables for Structured Search
            parsed_shelf = None
            parsed_module = None
            parsed_level = None
            target_location_ids = []
            
            if shelf_match:
                # User is likely asking for a specific shelf
                # We construct the ID prefix, e.g. "E1"
                suffix = shelf_match.group(1).upper()
                # If suffix is just a number, prepend E. If it's like "E1", keep it.
                if suffix.isdigit():
                    target_location_id = f"E{suffix}"
                else:
                     target_location_id = suffix if suffix.startswith("E") else f"E{suffix}"
                
                parsed_shelf = target_location_id

                # Check for MODULE (M)
                mod_match = re.search(r'm[oó]d(?:ulo)?\s*(\d+)', user_query)
                
                # We will build a list of valid prefixes to check
                base_prefixes = [target_location_id]
                
                if mod_match:
                    mod_num_str = mod_match.group(1)
                    mod_num = int(mod_num_str)
                    parsed_module = str(mod_num) # Store as string for comparison

                    new_prefixes = []
                    for prefix in base_prefixes:
                        # Variant 1: As provided (M1)
                        new_prefixes.append(f"{prefix}-M{mod_num_str}")
                        # Variant 2: Zero padded (M01) if single digit
                        if mod_num < 10 and len(mod_num_str) == 1:
                            new_prefixes.append(f"{prefix}-M0{mod_num}")
                    base_prefixes = new_prefixes
                    
                    # Check for LEVEL/HEIGHT (A)
                    lvl_match = re.search(r'(?:altura|nivel|alt)\s*(\d+)', user_query)
                    if lvl_match:
                        lvl_num_str = lvl_match.group(1)
                        lvl_num = int(lvl_num_str)
                        parsed_level = str(lvl_num)

                        final_prefixes = []
                        for prefix in base_prefixes:
                             # Variant 1: As provided (A1)
                            final_prefixes.append(f"{prefix}-A{lvl_num_str}")
                            # Variant 2: Zero padded (A01)
                            if lvl_num < 10 and len(lvl_num_str) == 1:
                                final_prefixes.append(f"{prefix}-A0{lvl_num}")
                        base_prefixes = final_prefixes

                print(f"ASSISTANT: Precise location candidates: {base_prefixes}")
                target_location_ids = base_prefixes

            # Pattern: "palet" followed by NUMBER only (avoid "palet de...")
            pallet_match = re.search(r'palet\s*(\d+)', user_query)
            if pallet_match:
                # User asking for Pallet ID
                pid = pallet_match.group(1).upper()
                target_location_ids = [pid] # Pallets are usually exact or single format, but could add padding helper if needed later
                print(f"ASSISTANT: Detected pallet query. Target ID: {pid}")

            # --- SEARCH EXECUTION ---
            
            if target_location_ids:
                # STRATEGY A: ID-REGISTRO/UBICACION SEARCH (Combined)
                print(f"ASSISTANT: Running TARGET SEARCH for {target_location_ids}")
                target_found = False
                
                for row in all_items:
                    # 1. Try Granular Match using ID strings
                    # STRIP to avoid " E1-M1 " mismatch
                    loc_id = str(row.get('ID_REGISTRO') or row.get('ID_UBICACION', '')).upper().strip()
                    
                    matched_strategy_a = False
                    for tid in target_location_ids:
                        if loc_id == tid or loc_id.startswith(f"{tid}-"):
                             matched_strategy_a = True
                             break
                    
                    if matched_strategy_a:
                        found_items.append(row)
                        target_found = True
                        continue

                    # 2. STRATEGY B: STRUCTURED COLUMN SEARCH
                    # Use parsed shelf, module, level against distinct columns if available
                    # Only if we have at least a Shelf parsed
                    if parsed_shelf:
                        row_shelf = str(row.get('ID_LUGAR') or row.get('ID_UBICACION', '')).upper().strip()
                        # Allow fuzzy match for shelf? No, keep strict for now. E1 vs E1.
                        
                        if row_shelf == parsed_shelf:
                            # Shelf Matches. Now Check Module?
                            match_mod = True
                            if parsed_module:
                                # Compare 'MODULO' column. normalize to string/int check
                                row_mod = str(row.get('MODULO', '')).strip()
                                # Handle "2" vs "02" -> simple int conversion check if digits
                                if row_mod.isdigit() and parsed_module.isdigit():
                                    if int(row_mod) != int(parsed_module): match_mod = False
                                else:
                                    if row_mod != parsed_module: match_mod = False
                            
                            if match_mod:
                                match_lvl = True
                                if parsed_level:
                                    row_lvl = str(row.get('ALTURA', '')).strip()
                                    if row_lvl.isdigit() and parsed_level.isdigit():
                                          if int(row_lvl) != int(parsed_level): match_lvl = False
                                    else:
                                          if row_lvl != parsed_level: match_lvl = False
                                
                                if match_lvl:
                                    found_items.append(row)
                                    target_found = True

            else:
                # STRATEGY B: CONTENT/KEYWORD SEARCH (Broad)
                print(f"ASSISTANT: Running KEYWORD SEARCH for '{user_query}'")
                terms = user_query.split()
                # Filter stop words but KEEP numbers and short IDs
                stop_words = [
                    "donde", "dónde", "hay", "haya", "el", "la", "los", "las", "un", "una", 
                    "stock", "en", "de", "que", "y", "o", "contenido", "dentro",
                    "dime", "decir", "todos", "todas", "todo", "toda", "sitios", "lugares", "ubicaciones",
                    "buscar", "busca", "encuentra", "ver", "listar", "cual", "cuales", "quien", 
                    "mostrar", "enseñar", "ver"
                ]
                search_keywords = [t for t in terms if t.lower() not in stop_words]
                
                print(f"ASSISTANT: Search keywords after filtering: {search_keywords}")
                
                if not search_keywords:
                    # If all words were stop words, return nothing or maybe hint user?
                    msg = "No he detectado palabras clave válidas. Intenta ser más específico." 
                    # We leave msg empty/default fallback in summary generation relies on found_items being empty
                    pass
                else:
                    # 1. First Pass: Strict matches
                    for row in all_items:
                        mat = normalize(row.get('MATERIAL', ''))
                        loc = normalize(row.get('ID_UBICACION', ''))
                        typ = normalize(row.get('TIPO_ITEM', ''))
                        # Add LOTE or PROGRAMA to search 
                        lote = normalize(row.get('LOTE', row.get('PROGRAMA', '')))
                        searchable_text = f"{mat} {loc} {typ} {lote}"
                        
                        if all(k.lower() in searchable_text for k in search_keywords):
                            found_items.append(row)
                    
                    # 2. Second Pass: Relaxed (Singular/Plural) if no results found
                    if not found_items:
                        # Generate variations for each keyword (e.g. "balones" -> "balon")
                        relaxed_keywords = []
                        for k in search_keywords:
                            variations = [k.lower()]
                            k_lower = k.lower()
                            if k_lower.endswith('es') and len(k_lower) > 3: variations.append(k_lower[:-2]) # balones -> balon
                            if k_lower.endswith('s') and len(k_lower) > 3: variations.append(k_lower[:-1])  # sillas -> silla
                            relaxed_keywords.append(variations)
                        
                        print(f"ASSISTANT: Using relaxed keywords: {relaxed_keywords}")
                        
                        # We need to find rows that have AT LEAST ONE match for EACH keyword group
                        # e.g. search: "cajas balones" -> needs (caja OR cajas) AND (balon OR balones)
                        
                        for row in all_items:
                            mat = normalize(row.get('MATERIAL', ''))
                            loc = normalize(row.get('ID_UBICACION', ''))
                            typ = normalize(row.get('TIPO_ITEM', ''))
                            lote = normalize(row.get('LOTE', row.get('PROGRAMA', '')))
                            searchable_text = f"{mat} {loc} {typ} {lote}"
                            
                            # check if this row satisfies all keyword groups
                            all_groups_match = True
                            for group in relaxed_keywords:
                                if not any(var in searchable_text for var in group):
                                    all_groups_match = False
                                    break
                            
                            if all_groups_match:
                                found_items.append(row)
                                
                print(f"ASSISTANT: Keyword search found {len(found_items)} items")

            # --- SUMMARY GENERATION ---
            if found_items:
                # Group by Material to give a cleaner answer
                summary_map = {} # Material -> {qty: 0, locs: set()}
                
                for item in found_items:
                    mat = item.get('MATERIAL', 'Desconocido')
                    loc_raw = item.get('ID_UBICACION') or item.get('ID_LUGAR')
                    loc = str(loc_raw).strip() if loc_raw and str(loc_raw).strip() != '' else 'Ubicación Desconocida'
                    try:
                        qty = int(item.get('CANTIDAD', 0))
                    except:
                        qty = 0
                    
                    if mat not in summary_map:
                        summary_map[mat] = {'qty': 0, 'locs': set()}
                    
                    summary_map[mat]['qty'] += qty
                    summary_map[mat]['locs'].add(loc)
                
                lines = []
                total_items_count = 0
                
                for mat, data in summary_map.items():
                    qty = data['qty']
                    locs_list = sorted(list(data['locs']))
                    
                    # Prettify locations
                    pretty_locs = []
                    for l in locs_list:
                        if l.isdigit():
                            pretty_locs.append(f"Palet {l}")
                        elif l.startswith("E") and len(l) > 1 and l[1:].isdigit():
                            pretty_locs.append(f"Estantería {l[1:]}")
                        else:
                            pretty_locs.append(l)

                    # Truncate location list if too long
                    locs_str = ", ".join(pretty_locs[:3])
                    if len(locs_list) > 3:
                        locs_str += f" (+{len(locs_list)-3} más)"
                        
                    lines.append(f"• {qty} un. de {mat} (en {locs_str})")
                    total_items_count += qty
                
                # Limit output lines
                if len(lines) > 8:
                    lines = lines[:8]
                    lines.append(f"... y otros.")

                intro = f"He encontrado {total_items_count} artículos"
                if target_location_ids:
                     intro += f" en {target_location_ids[0]}"
                
                interpretation.summary = f"{intro}:\n" + "\n".join(lines)

            else:
                 msg = "No he encontrado nada."
                 if target_location_ids:
                     # Use the first candidate for display, e.g. "E1-M1"
                     nice_loc = target_location_ids[0]
                     msg = f"No he encontrado nada en la ubicación {nice_loc} (o sus variantes). ¿Es posible que esté vacía?"
                 else:
                     msg = "No he encontrado coincidencias para esa búsqueda en el inventario."
                 interpretation.summary = msg
                 
        except Exception as e:
            print(f"ASSISTANT SEARCH ERROR: {e}")
            interpretation.summary = f"Error buscando en el inventario: {e}"

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
        message = "Acción completada con éxito."
        
        if current_user.role == "VISITOR":
             raise HTTPException(status_code=403, detail="Visitors cannot execute actions.")
             
        elif current_user.role == "USER":
            # Queue for Approval
            action_id = sheet_service.add_pending_action(interpretation.movements, user_id=current_user.email)
            return AssistantConfirmResponse(
                status="PENDING_APPROVAL",
                transaction_id=action_id,
                message="Solicitud enviada a aprobación."
            )
            
        elif current_user.role == "ADMIN":
            # Execute Immediately
            sheet_service.execute_transaction(interpretation.movements, user_id=current_user.email, transaction_id="TX-mock")
            
            # Generate Logic Message
            if interpretation.intent == "ENTRADA" and interpretation.movements:
                mov = interpretation.movements[0]
                message = f"✅ Entrada registrada: **{mov.item}** (x{mov.qty}) en **{mov.destination}**."
            elif interpretation.intent == "MOVIMIENTO" and interpretation.movements:
                mov = interpretation.movements[0]
                message = f"✅ Movimiento realizado: **{mov.item}** de {mov.origin} a **{mov.destination}**."
            elif interpretation.intent == "SALIDA":
                message = "✅ Salida registrada."
            
        else:
             raise HTTPException(status_code=403, detail="Unknown role permissions")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        return AssistantConfirmResponse(status="ERROR", error=str(e))
    
    return AssistantConfirmResponse(
        status="SUCCESS",
        transaction_id=f"TX-{hash(request.token)}",
        updated_balance={},
        message=message
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
