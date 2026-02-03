
# CODE SUPREMACY SOURCE
# Validation mirror of frontend src/data.ts
# This file defines the ONLY valid structural IDs in the warehouse.

def generate_valid_locations() -> set[str]:
    valid_ids = set()

    # 1. Pallets (1-67)
    for i in range(1, 68):
        valid_ids.add(str(i))

    # 2. Structural/Special
    valid_ids.add("van_v3")
    valid_ids.add("door_v3")
    valid_ids.add("muro_pared_entrada")

    # 3. Shelves (Modules & Levels)
    # Definition: { ShelfID: ModuleCount } (All have 4 levels A1-A4)
    shelves = {
        "E1": 3,
        "E2": 6, 
        "E3": 6,
        "E4a": 2,
        "E4b": 6,
        "E5": 2,
        "E6": 2,
        "E7": 2,
        "E8": 1
    }

    for shelf_id, modules in shelves.items():
        # Add the Shelf itself? Usually we don't store inventory on the Shelf object, but inside slots.
        # But for 'location' validation, the shelf exists.
        valid_ids.add(shelf_id)

        for m in range(1, modules + 1):
            for a in range(1, 5): # Levels 1-4
                # format: E1-M1-A1
                slot_id = f"{shelf_id}-M{m}-A{a}"
                valid_ids.add(slot_id)

    return valid_ids

VALID_LOCATIONS = generate_valid_locations()
