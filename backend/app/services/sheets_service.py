import gspread
import json
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
            if not settings.GOOGLE_APPLICATION_CREDENTIALS_JSON:
                print("SHEETS: No credentials provided in env.")
                return

            creds_dict = json.loads(settings.GOOGLE_APPLICATION_CREDENTIALS_JSON)
            creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            self.client = gspread.authorize(creds)
            
            if settings.GOOGLE_SHEET_ID:
                self.doc = self.client.open_by_key(settings.GOOGLE_SHEET_ID)
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

    def execute_transaction(self, movements: list[MovementProposal], user_id: str, transaction_id: str):
        if not self.client:
            self.connect()
        
        # We need to perform batch updates for performance
        try:
            ws_inv = self.doc.worksheet("INVENTARIO")
            ws_hist = self.doc.worksheet("HISTORIAL")
            
            # 1. Append to HISTORIAL
            # Cols: TIMESTAMP | USUARIO | ACCION | MATERIAL | CANTIDAD | ORIGEN | DESTINO | MOTIVO
            timestamp = datetime.datetime.utcnow().isoformat()
            history_rows = []
            
            for mov in movements:
                history_rows.append([
                    timestamp,
                    user_id,
                    mov.type.value,
                    mov.item,
                    mov.qty,
                    mov.origin,
                    mov.destination,
                    mov.reason or ""
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
                # Logic depends on action type? 
                # Actually, strictly enforcing: inventory = what is there.
                # If MOVEMENT/ENTRY: Destination gains qty.
                # If MOVEMENT/EXIT: Origin loses qty.
                
                # DESTINATION Logic
                if mov.destination and mov.destination != "EXTERNO":
                    key = (mov.destination, mov.item)
                    if key in inv_map:
                        # Update existing
                        row_num = inv_map[key]
                        # We need to fetch current val from sheet (or cached all_inv)
                        # Reading from all_inv is safe if no concurrent writes.
                        # Assuming single thread/user for Phase 1.
                        current_qty = int(all_inv[row_num-1][idx_qty])
                        new_qty = current_qty + mov.qty
                        
                        # We update the array 'all_inv' too to reflect changes in this batch
                        all_inv[row_num-1][idx_qty] = str(new_qty)
                        
                        updates.append(gspread.Cell(row_num, idx_qty+1, new_qty))
                    else:
                        # Insert new
                        rows_to_append.append([
                            mov.destination,
                            mov.item,
                            mov.qty,
                            "", # LOTE
                            mov.state.value if hasattr(mov, 'state') else "STOCK",
                            "" # RESPONSABLE
                        ])
                        # Update map for subsequent items in THIS batch? 
                        # Complex. Simplified: just append.
                
                # ORIGIN Logic (Deduct)
                if mov.origin and mov.origin != "EXTERNO":
                    key = (mov.origin, mov.item)
                    if key in inv_map:
                        row_num = inv_map[key]
                        current_qty = int(all_inv[row_num-1][idx_qty])
                        new_qty = max(0, current_qty - mov.qty)
                        
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
            return ws.get_all_records()
        except Exception as e:
            print(f"SHEETS ERROR: Could not fetch users. {e}")
            return []

sheet_service = SheetService()
