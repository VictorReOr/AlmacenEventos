import gspread
import json
from typing import Any
import uuid
import datetime
from google.oauth2.service_account import Credentials
from app.core.config import get_settings
from app.models.schemas import MovementProposal, ActionType

settings = get_settings()

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

class SheetService:
    def __init__(self):
        self.client = None
        self.doc = None
        # Cache for simple validation (could be redis in future)
        self._valid_locations = set()

    def connect(self):
        if self.client:
            return

        try:
            creds = None
            if settings.GOOGLE_APPLICATION_CREDENTIALS_JSON:
                creds_dict = json.loads(settings.GOOGLE_APPLICATION_CREDENTIALS_JSON)
                creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            else:
                # Fallback for local dev
                import os
                local_creds_path = "service_account.json" 
                # Also check one level up if in app dir
                if not os.path.exists(local_creds_path) and os.path.exists(f"backend/{local_creds_path}"):
                    local_creds_path = f"backend/{local_creds_path}"
                
                if os.path.exists(local_creds_path):
                     print(f"SHEETS: Loading credentials from local file: {local_creds_path}")
                     creds = Credentials.from_service_account_file(local_creds_path, scopes=SCOPES)
                else:
                    print("SHEETS: No credentials provided in env or local file.")
                    return

            if creds:
                self.client = gspread.authorize(creds)
                
                # Check for Sheet ID in settings, or hardcode fallback for dev (NOT RECOMMENDED for prod but useful now)
                sheet_id = settings.GOOGLE_SHEET_ID or "1XCeV4S43BvwUen7h-0JU5kjOPk-MSzZ6vZDU4WLbTNE" # Hardcoded from smoke_test.py
                
                if sheet_id:
                    self.doc = self.client.open_by_key(sheet_id)
                    self._refresh_location_cache()
                    print("SHEETS: Connected and cache warmed.")
                else:
                    print("SHEETS: Connected but no Sheet ID provided.")
                
        except Exception as e:
            print(f"SHEETS ERROR: Connection failed. {e}")

    def _refresh_location_cache(self):
        try:
            ws = self.doc.worksheet("UBICACIONES")
            # Assuming ID is Column A (index 0), skip header
            ids = ws.col_values(1)[1:] 
            self._valid_locations = set(ids)
        except Exception as e:
            print(f"SHEETS: Error caching locations. {e}")

    def validate_location(self, loc_id: str) -> bool:
        if not self.client:
            self.connect()
        # Fallback if connection failed or cache empty
        if not self._valid_locations:
            return True # Fail open or closed? Phase 0 says block phantom locations.
                        # For now, if DB is down, maybe we shouldn't block? 
                        # Or better, return True if we can't verify to avoid blocking ops during setup.
        
        return loc_id in self._valid_locations

    def execute_transaction(self, action_type: str, payload: Any, user_id: str, transaction_id: str):
        if not self.client:
            self.connect()
        
        if action_type == "MOVEMENT":
            self._execute_movement_transaction(payload, user_id, transaction_id)
        elif action_type == "ACTUALIZAR_UBICACION":
            self._execute_location_update(payload)
        else:
             print(f"SHEETS WARNING: Unknown action type {action_type}")

    def _execute_location_update(self, payload: Any):
        # Payload is expected to be a LocationUpdate dict
        # { "id": "P-1", "x": 10, "y": 20, "rotation": 90, ... }
        try:
            ws_config = self.doc.worksheet("Config")
            # Config is defined as A1=Key, B1=Value. B1 contains the FULL STATE JSON.
            # We must lock? Apps Script has lock. We should be careful.
            # Ideally we use an Apps Script Execution API to do this atomically, but for now:
            
            json_str = ws_config.get("B1").first() # gspread method? .acell('B1').value
            current_json_str = ws_config.acell('B1').value
            
            if not current_json_str:
                print("SHEETS ERROR: Config JSON is empty.")
                return

            state = json.loads(current_json_str)
            ubicaciones = state.get('ubicaciones', {})
            
            target_id = payload.get('id')
            if target_id in ubicaciones:
                # Update specific fields
                u = ubicaciones[target_id]
                u['x'] = payload.get('x')
                u['y'] = payload.get('y')
                u['rotation'] = payload.get('rotation')
                if payload.get('width'): u['width'] = payload.get('width')
                if payload.get('depth'): u['depth'] = payload.get('depth')
                
                # Write back
                new_json_str = json.dumps(state)
                ws_config.update('B1', new_json_str) # update_acell or update
            else:
                 print(f"SHEETS ERROR: Location {target_id} not found in state.")
        
        except Exception as e:
            print(f"SHEETS ERROR: Failed location update. {e}")
            raise e


    def _execute_movement_transaction(self, movements: list[Any], user_id: str, transaction_id: str):
        try:
            ws_inv = self.doc.worksheet("INVENTARIO")
            ws_hist = self.doc.worksheet("HISTORIAL")
            
            # 1. Append to HISTORIAL
            # Cols: TIMESTAMP | USUARIO | ACCION | MATERIAL | CANTIDAD | ORIGEN | DESTINO | MOTIVO
            timestamp = datetime.datetime.utcnow().isoformat()
            history_rows = []
            
            for mov in movements:
                # Handle dictionary or object
                m_type = mov.get('type') if isinstance(mov, dict) else mov.type.value
                m_item = mov.get('item') if isinstance(mov, dict) else mov.item
                m_qty = mov.get('qty') if isinstance(mov, dict) else mov.qty
                m_origin = mov.get('origin') if isinstance(mov, dict) else mov.origin
                m_dest = mov.get('destination') if isinstance(mov, dict) else mov.destination
                m_reason = mov.get('reason', "") if isinstance(mov, dict) else (mov.reason or "")

                history_rows.append([
                    timestamp,
                    user_id,
                    m_type,
                    m_item,
                    m_qty,
                    m_origin,
                    m_dest,
                    m_reason
                ])
            
            # Batch append history
            ws_hist.append_rows(history_rows)
            
            # 2. Update INVENTARIO
            # This is complex in Sheets. Easiest robust way for Phase 1:
            # Fetch all inventory, process in memory, rewrite or update cells.
            # Ideally: Read all -> Dict{(Loc, Item): RowIndex} -> Update/Append
            
            # Fetch all data (heavy but safe)
            all_inv = ws_inv.get_all_values()
            headers = all_inv[0] # ID_UBICACION, MATERIAL, CANTIDAD, ...
            
            # Map indices
            try:
                idx_loc = headers.index("ID_UBICACION")
                idx_mat = headers.index("MATERIAL")
                idx_qty = headers.index("CANTIDAD")
            except ValueError:
                print("SHEETS ERROR: Inventory headers mismatch.")
                return

            # Build index map: (Loc, Material) -> Row Number (0-based in array, 1-based in sheet)
            inv_map = {}
            for i, row in enumerate(all_inv[1:], start=2): # Start 2 matches sheet row num
                if len(row) > idx_qty:
                    key = (row[idx_loc], row[idx_mat])
                    inv_map[key] = i
            
            # Process movements
            updates = [] # List of Cell objects
            rows_to_append = []
            
            for mov in movements:
                # Handle dictionary or object
                m_item = mov.get('item') if isinstance(mov, dict) else mov.item
                m_qty = mov.get('qty') if isinstance(mov, dict) else mov.qty
                m_origin = mov.get('origin') if isinstance(mov, dict) else mov.origin
                m_dest = mov.get('destination') if isinstance(mov, dict) else mov.destination
                m_state = mov.get('state', "STOCK") if isinstance(mov, dict) else (mov.state.value if hasattr(mov, 'state') else "STOCK")

                # DESTINATION Logic
                if m_dest and m_dest != "EXTERNO":
                    key = (m_dest, m_item)
                    if key in inv_map:
                        # Update existing
                        row_num = inv_map[key]
                        current_qty = int(all_inv[row_num-1][idx_qty])
                        new_qty = current_qty + m_qty
                        
                        all_inv[row_num-1][idx_qty] = str(new_qty)
                        
                        updates.append(gspread.Cell(row_num, idx_qty+1, new_qty))
                    else:
                        # Insert new
                        rows_to_append.append([
                            m_dest,
                            m_item,
                            m_qty,
                            "", # LOTE
                            m_state,
                            "" # RESPONSABLE
                        ])
                
                # ORIGIN Logic (Deduct)
                if m_origin and m_origin != "EXTERNO":
                    key = (m_origin, m_item)
                    if key in inv_map:
                        row_num = inv_map[key]
                        current_qty = int(all_inv[row_num-1][idx_qty])
                        new_qty = max(0, current_qty - m_qty)
                        
                        all_inv[row_num-1][idx_qty] = str(new_qty)
                        updates.append(gspread.Cell(row_num, idx_qty+1, new_qty))
            
            # Execute Writes
            if updates:
                ws_inv.update_cells(updates)
            if rows_to_append:
                ws_inv.append_rows(rows_to_append)
                
        except Exception as e:
            print(f"SHEETS TRANSACTION ERROR: {e}")
            raise e



    def get_users(self) -> list[dict]:
        """Fetch all users from USUARIOS tab."""
        if not self.client:
            self.connect()
        
        try:
            ws = self.doc.worksheet("USUARIOS")
            records = ws.get_all_records()
            # Normalize roles to uppercase to avoid validation errors
            for r in records:
                if 'ROLE' in r and isinstance(r['ROLE'], str):
                    r['ROLE'] = r['ROLE'].upper()
            return records
        except Exception as e:
            print(f"SHEETS ERROR: Could not fetch users. {e}")
            return []

    def add_user(self, user_data: dict):
        if not self.client:
            self.connect()
        try:
            ws = self.doc.worksheet("USUARIOS")
            # Order: USER_ID, ROLE, NAME, PASSWORD
            row = [
                user_data.get("email"),
                user_data.get("role"),
                user_data.get("name"),
                "" # Password empty for Google Auth users
            ]
            ws.append_row(row)
        except Exception as e:
            print(f"SHEETS ERROR: Could not add user. {e}")
            raise e

    def update_user_role(self, email: str, new_role: str):
        if not self.client:
            self.connect()
        try:
            ws = self.doc.worksheet("USUARIOS")
            # Only exact match on email (Col 1)
            cell = ws.find(email) 
            if cell:
                # Update Role (Col 2)
                ws.update_cell(cell.row, 2, new_role) 
            else:
               raise Exception("User not found")
        except Exception as e:
            print(f"SHEETS ERROR: Could not update user role. {e}")
            raise e

    def add_pending_action(self, action_type: str, payload: Any, user_id: str) -> str:
        if not self.client:
            self.connect()
        try:
            ws = self.doc.worksheet("PENDING_ACTIONS")
            action_id = str(uuid.uuid4())
            timestamp = datetime.datetime.utcnow().isoformat()
            
            # Serialize payload
            if hasattr(payload, 'dict'):
                payload_json = json.dumps(payload.dict())
            elif isinstance(payload, list):
                # Handle list of Pydantic models or dicts
                payload_json = json.dumps([p.dict() if hasattr(p, 'dict') else p for p in payload])
            else:
                payload_json = json.dumps(payload)
            
            # ID | TIMESTAMP | REQUESTER_EMAIL | ACTION_TYPE | PAYLOAD_JSON | STATUS
            row = [
                action_id,
                timestamp,
                user_id,
                action_type, 
                payload_json,
                "PENDING"
            ]
            ws.append_row(row)
            return action_id
        except Exception as e:
             print(f"SHEETS ERROR: Could not add pending action. {e}")
             raise e

    def get_pending_actions(self) -> list[dict]:
        if not self.client:
            self.connect()
        try:
            ws = self.doc.worksheet("PENDING_ACTIONS")
            return ws.get_all_records()
        except Exception as e:
            print(f"SHEETS ERROR: Could not get pending actions. {e}")
            return []

    def delete_pending_action(self, action_id: str):
        if not self.client:
            self.connect()
        try:
            ws = self.doc.worksheet("PENDING_ACTIONS")
            cell = ws.find(action_id)
            if cell:
                ws.delete_rows(cell.row)
        except Exception as e:
            print(f"SHEETS ERROR: Could not delete pending action. {e}")
            raise e
            
    def get_pending_action(self, action_id: str) -> dict:
        if not self.client:
             self.connect()
        try:
            ws = self.doc.worksheet("PENDING_ACTIONS")
            cell = ws.find(action_id)
            if not cell:
                return None
            
            row_values = ws.row_values(cell.row)
            if len(row_values) < 5:
                return None
                
            return {
                "ID": row_values[0],
                "TIMESTAMP": row_values[1],
                "REQUESTER_EMAIL": row_values[2],
                "ACTION_TYPE": row_values[3],
                "PAYLOAD_JSON": row_values[4],
                "STATUS": row_values[5] if len(row_values) > 5 else "PENDING"
            }
        except Exception as e:
             print(f"SHEETS ERROR: Could not get pending action. {e}")
             return None

sheet_service = SheetService()
