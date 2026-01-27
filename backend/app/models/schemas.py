from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

from enum import Enum

# --- ENUMS ---
class ActionType(str, Enum):
    ENTRADA = "ENTRADA"         # Inbound (Supplier -> Warehouse)
    SALIDA = "SALIDA"           # Outbound (Warehouse -> Client/Waste)
    MOVIMIENTO = "MOVIMIENTO"   # Internal (Loc A -> Loc B)
    MODIFICACION = "MODIFICACION" # Correction

class MaterialState(str, Enum):
    STOCK = "STOCK"
    PARA_PRESTAMO = "PARA_PRESTAMO"
    EN_PRESTAMO = "EN_PRESTAMO"
    REGALO = "REGALO"

# --- CORE ENTITIES ---
class MovementProposal(BaseModel):
    item: str
    qty: int
    origin: str  # ID Ubicacion or "EXTERNO"
    destination: str # ID Ubicacion or "EXTERNO"
    type: ActionType
    reason: Optional[str] = None
    state: MaterialState = MaterialState.STOCK

# --- API REQUESTS/RESPONSES ---

class AssistantParseRequest(BaseModel):
    text: str
    user_id: str
    image_base64: Optional[str] = None

class Interpretation(BaseModel):
    intent: str
    summary: str
    movements: List[MovementProposal]

class AssistantParseResponse(BaseModel):
    status: Literal["PROPOSAL_READY", "ERROR"]
    interpretation: Optional[Interpretation] = None
    warnings: List[str] = []
    token: Optional[str] = None # Signed JWT containing the interpretation
    error: Optional[str] = None

class AssistantConfirmRequest(BaseModel):
    token: str
    user_id: str

class AssistantConfirmResponse(BaseModel):
    status: Literal["SUCCESS", "ERROR"]
    transaction_id: Optional[str] = None
    updated_balance: Optional[Dict[str, int]] = None
    error: Optional[str] = None

# --- SHEETS ROW MODELS (Internal) ---
class LogRow(BaseModel):
    timestamp: str
    user: str
    action: str
    material: str
    qty: int
    origin: str
    destination: str
    details: str

class InventoryRow(BaseModel):
    id_ubicacion: str
    material: str
    cantidad: int
    estado: str
