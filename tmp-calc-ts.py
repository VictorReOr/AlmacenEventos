import json
import math

def get_x_on_right_wall(y):
    x1, y1 = 8.15, 0
    x2, y2 = 10.123777578084171, 26.945009114327945
    # Interpolate X for a given Y
    if y2 == y1: return x1
    fraction = (y - y1) / (y2 - y1)
    return x1 + fraction * (x2 - x1)

def calculate_layout():
    w = 0.8
    d = 1.2
    
    outs = []
    
    def add_pallet(id_str, x, y, rot):
        out = f"""                "{id_str}": {{
                        id: "{id_str}",
                        tipo: "palet",
                        programa: "Vacio",
                        contenido: "{id_str}",
                        x: {round(x, 6)},
                        y: {round(y, 6)},
                        rotation: {round(rot, 2)},
                        width: {w},
                        depth: {d}
                }}"""
        outs.append(out)

    # 1. Pared Arriba (Left Wall code)
    start_y = 15.25
    end_y = 1.0
    for i in range(16):
        pid = i + 1
        fraction = i / 15.0 if 15 > 0 else 0
        y = start_y + fraction * (end_y - start_y)
        x = 0.26 + fraction * (0.71 - 0.26)
        add_pallet(pid, x, y, 88.18)

    # 2. Pared Izquierda (Top Wall code) - USER FIX
    # Move them down slightly (larger X) so they aren't touching the top.
    start_x = 1.90  # Shift them down a bit again (was 1.75)
    spacing_x = 0.90 
    for i in range(7):
        pid = 17 + i
        x = start_x + i * spacing_x
        add_pallet(pid, x, 0.85, 0) # Vertical orientation

    # 3. Pared Abajo (Right Wall code)
    dx = 10.123777578084171 - 8.15
    dy = 26.945009114327945 - 0
    angle_deg = 90 + math.degrees(math.atan2(dx, dy)) # ~94.18

    offset_x = -0.75 
    
    start_y_abajo = 2.0  
    end_y_abajo = 15.5   
    
    for i in range(14):
        pid = 24 + i
        fraction = i / 13.0 if 13 > 0 else 0
        y = start_y_abajo + fraction * (end_y_abajo - start_y_abajo)
        base_x = get_x_on_right_wall(y)
        x = base_x + offset_x
        add_pallet(pid, x, y, angle_deg)

    # 4. Central Arriba
    start_y_ca1 = 4.0
    spacing_ca = 0.95
    for i in range(14):
        pid = 38 + i
        y = start_y_ca1 + i * spacing_ca
        add_pallet(pid, 3.4, y, 90)

    # 5. Central Abajo
    max_y_ca2 = 4.0 + 13 * spacing_ca
    for i in range(14):
        pid = 52 + i
        y = max_y_ca2 - i * spacing_ca
        add_pallet(pid, 4.6, y, 90)

    res = ",\n".join(outs) + ","
    
    with open("tmp-pallets-ts.txt", "w", encoding="utf-8") as f:
        f.write(res)

calculate_layout()
