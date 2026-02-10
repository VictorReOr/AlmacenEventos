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
    ACTUALIZAR_UBICACION = "ACTUALIZAR_UBICACION" # Map Coordinate Update

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
    location_update: Optional['LocationUpdate'] = None

class LocationUpdate(BaseModel):
    id: str
    x: float
    y: float
    rotation: float
    width: Optional[float] = None
    depth: Optional[float] = None

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
    status: Literal["SUCCESS", "ERROR", "PENDING_APPROVAL"]
    transaction_id: Optional[str] = None
    updated_balance: Optional[Dict[str, int]] = None
    message: Optional[str] = None # Descriptive success message or suggestions
    error: Optional[str] = None

class SubmitActionRequest(BaseModel):
    action_type: str
    payload: Dict[str, Any]

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

# --- AUTH MODELS ---
class User(BaseModel):
    email: str
    role: Literal["ADMIN", "USER", "VISITOR"]
    name: Optional[str] = None
    is_active: bool = True

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    token: str # The Google ID Token

class RegisterRequest(BaseModel):
    email: str
    name: str
    token: str # Google Token for verification

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

