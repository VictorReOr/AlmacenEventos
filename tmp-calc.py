import json
import math

def calculate_layout():
    # Pallet dimensions
    w = 0.8  # width
    d = 1.2  # depth
    spacing = 0.95  # spacing between centers along the line

    new_ubicaciones = {}

    def add_pallet(id_str, x, y, rot):
        new_ubicaciones[str(id_str)] = {
            "id": str(id_str),
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": str(id_str),
            "x": round(x, 6),
            "y": round(y, 6),
            "rotation": round(rot, 2),
            "width": w,
            "depth": d
        }

    # 1. Pared de arriba (Code Left Wall, X~0)
    # Pallets 1 to 16, starting from the RIGHT (Large Y down to Small Y)
    # Wall goes from (-0.86, 27) to (0,0) approx.
    # We want them to align with the angle.
    # Let's just linearly interpolate from Y=16 down to Y=1 (similar to old config)
    # Angle in old config: 88.18 (depth matches the wall slant).
    # In old config: X=0.26 at Y=15.25, X=0.71 at Y=1.
    start_y = 15.25
    end_y = 1.0
    for i in range(16):
        pid = i + 1  # 1 to 16 (1 is at start_y)
        fraction = i / 15.0 if 15 > 0 else 0
        y = start_y + fraction * (end_y - start_y)
        # Interpolate x to match wall slant slightly
        x = 0.26 + fraction * (0.71 - 0.26)
        add_pallet(pid, x, y, 88.18)

    # 2. Pared izquierda (Code Top Wall, Y=0.85 approx)
    # Pallets 17 to 23, starting from the TOP (Small X to Large X)
    # Old Top Wall had pallets at Y=0.85, X=2.0, 3.3, 4.7, 6.1 (spacing 1.35)
    # 7 pallets starting from X=1.0 to X=7.0 approx (with spacing ~ 0.95 or 1.0)
    start_x = 1.0
    for i in range(7):
        pid = 17 + i  # 17 to 23
        x = start_x + i * 1.05  # space them out
        add_pallet(pid, x, 0.85, 90)

    # 3. Pared de abajo (Code Right Wall, X~8)
    # Pallets 24 to 37, starting from the LEFT (Small Y to Large Y)
    # Old Right Wall had pallets at X=7.68 to 8.58, Y=3.85 to 16.2. Angle: 94.18
    # Start: Y=3.85 (Left), End: Y=16.2 (Right)
    # Total 14 pallets.
    start_y_abajo = 3.85
    end_y_abajo = 16.2
    for i in range(14):
        pid = 24 + i  # 24 to 37
        fraction = i / 13.0 if 13 > 0 else 0
        y = start_y_abajo + fraction * (end_y_abajo - start_y_abajo)
        x = 7.68 + fraction * (8.58 - 7.68)
        add_pallet(pid, x, y, 94.18)

    # 4. Pasillo central de arriba (Code Left Central Aisle, X=3.4)
    # Pallets 38 to 51, starting from the LEFT (Small Y to Large Y)
    # 14 pallets.
    start_y_ca1 = 4.0
    spacing_ca = 0.95
    for i in range(14):
        pid = 38 + i  # 38 to 51
        y = start_y_ca1 + i * spacing_ca
        add_pallet(pid, 3.4, y, 90)

    # 5. Pasillo central de abajo (Code Right Central Aisle, X=4.6)
    # Pallets 52 to 65, starting from the RIGHT (Large Y to Small Y)
    # 14 pallets. If we want them aligned with CA1, large Y is around 16.35
    max_y_ca2 = 4.0 + 13 * spacing_ca  # 4.0 + 12.35 = 16.35
    for i in range(14):
        pid = 52 + i  # 52 to 65
        y = max_y_ca2 - i * spacing_ca
        add_pallet(pid, 4.6, y, 90)

    print(json.dumps(new_ubicaciones, indent=4))

calculate_layout()
