
# CODE SUPREMACY: This file mirrors the structure in data.ts
# Any location ID not in this list will be rejected by the backend.

VALID_LOCATIONS = {
    # Pallets (1-67)
    *[str(i) for i in range(1, 68)],

    # Shelves
    "E1", "E2", "E3", "E4a", "E4b", "E5", "E6", "E7", "E8",
    
    # Zones
    "ZONA_CARGA", "RECEPCION"
}

# Mapping schema for V2 (Optional, for reference)
SCHEMA_V2 = {
    "A": "ID_REGISTRO",
    "B": "TIPO_UBICACION", 
    "C": "ID_LUGAR",
    "D": "MODULO",
    "E": "ALTURA",
    "F": "TIPO_ITEM",
    "G": "MATERIAL",
    "H": "CANTIDAD",
    "I": "LOTE",
    "J": "ESTADO",
    "K": "RESPONSABLE",
    "L": "OBSERVACIONES"
}
