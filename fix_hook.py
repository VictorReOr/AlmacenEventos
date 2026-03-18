import os

hook_path = r'c:\Users\victo\.gemini\antigravity\scratch\warehouse-visual-map\src\hooks\useWarehouseState.ts'

with open(hook_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if 'const [isChatbotOpen' in line: continue
    if 'const [pendingAssistantAction' in line: continue
    if 'const [isAdminOpen' in line: continue
    if 'const [viewMode' in line: continue
    if 'const assistantRef =' in line: continue
    if 'const [assistantPos' in line: continue
    if 'const [{ x, y }, api] = useSpring' in line: continue
    
    if 'const bindAssistantDrag = useDrag' in line:
        skip = True
        continue
    if skip and '  });' in line:
        skip = False
        continue
    if skip: continue
    
    if 'const [isPortrait' in line: continue
    if "useEffect(() => {" in line and "window.addEventListener('resize'" in "".join(lines):
        # We need to be careful with multiline useEffects
        pass
    if 'const handleResize = () => setIsPortrait' in line:
        skip = True
        continue
    if skip and '  }, []);' in line:
        skip = False
        continue
    if skip: continue
        
    if 'const [showConfig' in line: continue
    if 'const { user, logout } = useAuth();' in line: continue
    if 'console.log("AuthenticatedApp: useAuth() called");' in line: continue
    
    new_lines.append(line)

with open(hook_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
    
print("Hook fixed")
