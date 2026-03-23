import re

def patch_data():
    with open('src/data.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    with open('tmp-pallets-ts.txt', 'r', encoding='utf-8') as f:
        pallets_str = f.read()

    # Find the start of the object
    start_marker = "const ubicaciones: Record<string, Ubicacion> = {\n"
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Could not find start marker")
        return

    # Find the start of E2 (first non-pallet element)
    end_marker = '                "E2": {'
    end_idx = content.find(end_marker, start_idx)
    if end_idx == -1:
        # Fallback to E3 or E1 or van_v3 depending on what exists
        print("Could not find E2 marker")
        return

    # Reconstruct
    new_content = content[:start_idx + len(start_marker)] + pallets_str + "\n" + content[end_idx:]

    with open('src/data.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Successfully patched data.ts!")

patch_data()
