import { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginModal } from './components/Login/LoginModal';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';

// Components
import { AppShell } from './components/Layout/AppShell';
import { Header } from './components/Layout/Header';
import { AssistantCharacter } from './components/Assistant/AssistantCharacter';
import { AssistantChat } from './components/Assistant/AssistantChat';
import { AssistantAlert } from './components/Assistant/AssistantAlert';
import WarehouseMap from './WarehouseMap';
import PropertiesPanel from './PropertiesPanel';
import { ConfigModal } from './ConfigModal';
import { QuickSearch } from './components/UI/QuickSearch';
import { PrintModal } from './components/UI/PrintModal';
import type { PrintOptions } from './components/UI/PrintModal';
import { PrintView } from './components/Print/PrintView';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { UserMenu } from './components/Layout/UserMenu';
import { DraggableLegend } from './components/UI/DraggableLegend';
import {
  IconShield,
  IconSettings,
  IconSelection,
  IconPrinter,
  IconGrid,
  IconCloudDown,
  IconSave,
  IconUndo,
  IconRedo
} from './components/UI/Icons';

// Logic & Types
import { PROGRAM_COLORS } from './types';
import type { Ubicacion } from './types';
import { generateInitialState } from './data';
import type { WarehouseMapRef } from './WarehouseMap';
import { GoogleSheetsService } from './services/GoogleSheetsService';
import { AssistantService } from './services/AssistantService';
import { InventoryService } from './services/InventoryService';
import { validateInventory } from './utils/inventoryValidation';
import type { InventoryError } from './utils/inventoryValidation';
import { InventoryErrorsModal } from './components/Admin/InventoryErrorsModal';
import { sanitizeState } from './utils/cleanup';

// Styles
import './App.css';

import './styles/print.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useIsMobile } from './hooks/useIsMobile';

// --- HISTORY HOOK ---
import { useHistory } from './hooks/useHistory';

// Removed local useHistory definition


function AuthenticatedApp() {
  // The comments below were part of the original App component, now moved to AuthenticatedApp
  // Use hooks before conditional return to avoid Rule of Hooks violation? 
  // Wait, if I return early, hooks below won't run. That is a violation.
  // I must move all hooks up OR move Auth logic to a wrapper component.
  // Converting App to RequireAuth wrapper is cleaner, but App has complex state logic.
  // Use a sub-component?
  // Let's assume loading state is handled.
  // But useHistory is a hook.

  // Refactor:
  // AppContent = original App content
  // App = Wrapper with Auth check.

  // Actually, I can just initialize useHistory and others, BUT if I return early, 
  // subsequent renders must match hook order.
  // If isLoading changes from true to false, hooks are consistent (if I call them all).
  // But if !user returns, I skip hooks?
  // NO. `if (!user)` is a return. Below it are hooks.
  // If user becomes present, hooks run.
  // React requires that the SAME number of hooks run in the SAME order on every render.

  // So I CANNOT return early before hooks if the condition changes.
  // `isLoading` starts true, then becomes false. Condition changes. Hooks below act up?
  // Yes.

  // Solution: Rename `App` to `AuthenticatedApp` and create a new `App` that handles Auth.

  console.log("AuthenticatedApp mounting...");

  const getInitialState = () => {
    try {
      const saved = localStorage.getItem('warehouse_V73.1_SHELVES_FIX');

      console.log("App: Generating fresh code state...");
      const codeState = generateInitialState();

      const defaults = { ubicaciones: codeState.ubicaciones, geometry: codeState.geometry };

      if (saved) {
        try {
          const parsed = JSON.parse(saved);

          // Validate Parsed Data
          const hasGeo = parsed.geometry && Array.isArray(parsed.geometry) && parsed.geometry.length > 0;
          const hasObjs = parsed.ubicaciones && Object.keys(parsed.ubicaciones).length > 0;

          if (!hasGeo && !hasObjs) {
            console.warn("⚠️ Saved state is empty/invalid. Reverting to DEFAULTS.");
            return defaults;
          }

          // Merge Logic
          let mergedUbicaciones = hasObjs ? { ...codeState.ubicaciones, ...parsed.ubicaciones } : codeState.ubicaciones;

          // --- CODE SUPREMACY: DELEGATE TO CLEANUP.TS ---
          // This enforces that only objects defined in data.ts (Pristine) exist.
          return sanitizeState({
            ubicaciones: mergedUbicaciones,
            geometry: hasGeo ? parsed.geometry : defaults.geometry
          });
        } catch (e) {
          console.error("Error parsing saved state", e);
          return defaults;
        }
      }
      return defaults;
    } catch (e) {
      console.error("Error in getInitialState", e);
      const codeState = generateInitialState();
      return { ubicaciones: codeState.ubicaciones, geometry: codeState.geometry };
    }
  };

  const { state, pushState, undo, redo, canUndo, canRedo } = useHistory(getInitialState());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [pendingAssistantAction, setPendingAssistantAction] = useState<{ type: string, payload: any } | null>(null);
  const [lastFocusedId, setLastFocusedId] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [assistantAlert, setAssistantAlert] = useState<string | null>(null);
  console.log("AuthenticatedApp: useAuth() called");
  const { user, logout } = useAuth(); // Added logout
  const mapRef = useRef<WarehouseMapRef>(null);

  // Assistant Position (Draggable)
  const assistantRef = useRef<HTMLDivElement>(null);
  // Persistent Position
  const [assistantPos, setAssistantPos] = useLocalStorage<{ x: number, y: number }>('assistant_pos_v5', { x: 0, y: 0 });

  // Init spring from storage
  const [{ x, y }, api] = useSpring(() => ({ x: assistantPos.x, y: assistantPos.y }));

  const bindAssistantDrag = useDrag(({ offset: [ox, oy], tap, down, last }) => {
    if (tap) {
      if (!down) setIsChatbotOpen(prev => !prev);
    } else {
      // Direct mapping of offset to x/y.
      api.start({ x: ox, y: oy, immediate: down });
      if (last) {
        setAssistantPos({ x: ox, y: oy });
      }
    }
  }, {
    // Start from current values
    from: () => [x.get(), y.get()],
    filterTaps: true,
    rubberband: true
  });

  // DEBUG: Alert API URL on mount to verify connection path
  useEffect(() => {
    // console.log("🔌 Conectando a:", config.API_BASE_URL);
  }, []);
  // Layout Detection
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync & Config
  const [scriptUrl, setScriptUrl] = useState<string>(() => localStorage.getItem('google_script_url') || 'https://script.google.com/macros/s/AKfycbwPJThfJGQXx1J-TnRHtgZlh_TmrpZXBvMDTyomvy6BOnL9ebuZuYmt_ZH4hQ74DiAh/exec');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [programColors, setProgramColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('program_colors_config');
    console.log("App: Initializing programColors. Saved:", saved ? "YES" : "NO", saved);
    return saved ? JSON.parse(saved) : PROGRAM_COLORS;
  });

  useEffect(() => {
    console.log("App: Persisting programColors to localStorage:", programColors);
    localStorage.setItem('program_colors_config', JSON.stringify(programColors));
  }, [programColors]);

  // Print State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<Ubicacion[] | null>(null);

  // Validation State
  const [inventoryErrors, setInventoryErrors] = useState<InventoryError[]>([]);
  const [showErrorsModal, setShowErrorsModal] = useState(false);



  const [isSelectionMode, setIsSelectionMode] = useState(false); // New state for mobile selection
  const isMobile = useIsMobile();

  // Effects
  useEffect(() => { localStorage.setItem('google_script_url', scriptUrl); }, [scriptUrl]);
  useEffect(() => { localStorage.setItem('warehouse_V73.1_SHELVES_FIX', JSON.stringify(state)); }, [state]);
  useEffect(() => { localStorage.setItem('program_colors_config', JSON.stringify(programColors)); }, [programColors]);

  // --- HANDLERS (Same as before) ---
  const handleSaveToCloud = async () => {
    if (!scriptUrl) { setShowConfig(true); return; }
    setIsSyncing(true);
    try {
      const keys = Object.keys(state.ubicaciones);
      if (keys.length === 0) { alert("⚠️ El mapa está vacío."); return; }
      await GoogleSheetsService.save(scriptUrl, state);
      alert(`¡Guardado OK!(${keys.length} items)`);
    } catch (error) {
      console.error(error);
      alert('Error: ' + error);
    } finally { setIsSyncing(false); }
  };

  const handleLoadFromCloud = async (silent = false) => {
    if (!scriptUrl) { setShowConfig(true); return; }
    if (!silent && !confirm("Se sobrescribirán los cambios locales. ¿Continuar?")) return;
    setIsSyncing(true);
    try {
      // Pass the code defaults as the base state so the service can populate it with cloud inventory
      const defaults = generateInitialState();
      const baseState = { ubicaciones: defaults.ubicaciones, geometry: defaults.geometry };

      const data = await GoogleSheetsService.load(scriptUrl, baseState);

      if (data) {
        // Validation: Don't accept empty geometry from cloud
        if (!data.geometry || data.geometry.length === 0) {
          console.warn("Cloud data has no geometry. Ignoring.");
          if (!silent) alert('Error: Datos de nube corruptos o vacíos (sin geometría).');
          return;
        }

        // --- SANITIZE CLOUD DATA ---
        // Prevents ghosts from ConfigJson coming back
        const cleanData = sanitizeState(data);

        pushState(cleanData);
        if (!silent) alert('¡Cargado con éxito!');
      }
      else {
        if (!silent) alert('Error: Datos vacíos.');
      }
    } catch (error) {
      console.error(error);
      if (!silent) alert('Error: ' + error);
    } finally { setIsSyncing(false); }
  };


  // ... existing imports ...

  // Inside AuthenticatedApp:

  // Auto-Load on mount -> DISABLED to prevent overwriting local data with empty cloud data
  // Auto-Load on mount
  // Auto-Load on mount -> DISABLED (We use loadLiveInventory below)
  /*
  useEffect(() => {
    if (scriptUrl) {
      console.log("Auto-loading from cloud...");
      handleLoadFromCloud(true);
    }
  }, []);
  */

  // --- STATE AUDITOR: GHOST HUNTER ---
  useEffect(() => {
    const checkStateIntegrity = () => {
      console.log("🕵️‍♂️ Running State Integrity Check...");
      const pristine = generateInitialState();
      const validKeys = new Set(Object.keys(pristine.ubicaciones));
      const currentKeys = Object.keys(state.ubicaciones);

      const ghosts = currentKeys.filter(k => !validKeys.has(k));
      if (ghosts.length > 0) {
        console.error("👻 GHOSTS DETECTED IN STATE:", ghosts);
        alert(`👻 ERROR CRÍTICO: Se han detectado objetos fantasma en el estado: ${ghosts.join(', ')}. Esto confirma que la sanitización falló.`);
      } else {
        console.log("✅ State Integrity Verified: No ghosts.");
      }
    };
    checkStateIntegrity();
  }, [state.ubicaciones]);

  // --- NEW: Load Inventory from Backend (Google Sheets) ---
  useEffect(() => {
    const loadLiveInventory = async () => {
      console.log("App: loadLiveInventory() STARTED 🏁");
      try {
        console.log("App: Fetching live inventory...");
        const rawData = await InventoryService.fetchInventory();
        console.log("App: Fetch returned! 📦", rawData ? rawData.length : "NULL");

        if (rawData && rawData.length > 0) {
          console.log("App: Parsing inventory...");
          const updates = InventoryService.parseInventoryToState(rawData);
          console.log("App: Raw Inventory Items:", rawData.length);
          console.log("App: Parsed updates keys:", Object.keys(updates));

          // Merge updates into current state
          // We use function form of state setter if possible, but here we have `state` from useHistory
          // We must be careful not to create a race condition if simple state updates happen.
          // Since this runs once on mount, it should be fine to use current `state`.
          // However, `state` in dependency array would cause loop.
          // We use a ref or just `handleUpdate` if it merged? 
          // `handleUpdate` uses `state` from closure.

          // Better: Create a dedicated merge function that uses the *latest* state if inside useEffect?
          // Actually `handleUpdate` is defined in render scope, so it closes over `state`.
          // If we call it, it uses `state` at render time (mount time).
          // Which is fine because nothing else updates it yet.

          // Note: `handleUpdate` expects Ubicacion array. 
          // Our `updates` is Record<string, Partial<Ubicacion>>.
          // We need to convert it.

          const fullUpdates: Ubicacion[] = [];
          const currentUbicaciones = state.ubicaciones; // Closure state

          // 1. CLEAR EXISTING INVENTORY (Prevent Ghosts)
          // We create a fresh update for EVERY object in the state to wipe its inventory
          const clearedUbicaciones: Record<string, Ubicacion> = {};

          Object.values(currentUbicaciones).forEach(u => {
            // Create a base object with CLEARED inventory fields
            clearedUbicaciones[u.id] = {
              ...u,
              cajas: [],
              materiales: [],
              items: [], // Legacy
              shelfItems: {},
              cajasEstanteria: {},
              niveles: u.niveles ? u.niveles.map(l => ({ ...l, items: [] })) : undefined,
              contenido: u.tipo === 'palet' ? '' : u.contenido, // Keep structural labels
              programa: u.tipo === 'palet' ? 'Vacio' as any : u.programa
            };
          });

          // 2. APPLY FRESH UPDATES
          Object.entries(updates).forEach(([id, partial]) => {
            if (clearedUbicaciones[id]) {
              if (clearedUbicaciones[id]) {
                // Merge partial update into the CLEARED object
                clearedUbicaciones[id] = { ...clearedUbicaciones[id], ...partial };

                // DEBUG: Check if E1 is being updated
                if (id === 'E1') {
                  const items = (partial as any).cajasEstanteria ? Object.keys((partial as any).cajasEstanteria).length : 0;
                  console.log(`App: E1 updated with ${items} slots`);
                  // alert(`DEBUG: E1 found! Updating with ${items} slots.`); // Uncomment if needed, but console is safer
                }
              }
            }
          });

          // 3. CONVERT TO ARRAY FOR HANDLEUPDATE
          Object.values(clearedUbicaciones).forEach(u => fullUpdates.push(u));

          // --- DIAGNOSTIC: CONTRACT VERIFICATION ---
          let renderedMaterialsCount = 0;
          fullUpdates.forEach(u => {
            // Count Boxed Materials (Pallets)
            u.cajas?.forEach(c => renderedMaterialsCount += c.contenido.length);

            // Count Loose Materials (Pallets)
            if (u.materiales) renderedMaterialsCount += u.materiales.length;

            // Count Shelf Materials
            if (u.cajasEstanteria) {
              Object.values(u.cajasEstanteria).forEach(c => renderedMaterialsCount += c.contenido.length);
            }
          });

          console.log(`📊 CONTRACT DIAGNOSTIC:`);
          console.log(`   - Input Rows (Sheet): ${rawData.length}`);
          console.log(`   - Rendered Materials: ${renderedMaterialsCount}`);

          if (rawData.length !== renderedMaterialsCount) {
            console.error(`⚠️ DISCREPANCY DETECTED! Input ${rawData.length} != Rendered ${renderedMaterialsCount}. Check for rejected ghosts or unmapped items.`);
            // In strict mode, we might want to alert, but for now log error is sufficient.
          } else {
            console.log(`✅ DATA INTEGRITY VERIFIED. 1:1 Match.`);
          }

          if (fullUpdates.length > 0) {
            handleUpdate(fullUpdates);
            console.log("App: Live inventory applied.");

            // Run Validation on the NEW state (approximated by merging locally)
            // fullUpdates contains the NEW objects. We need to merge them with current to validate all.
            const validationState = { ...currentUbicaciones };
            fullUpdates.forEach(u => {
              if (validationState[u.id]) {
                validationState[u.id] = { ...validationState[u.id], ...u };
              } else {
                validationState[u.id] = u as Ubicacion;
              }
            });

            const errors = validateInventory(validationState);
            if (errors.length > 0) {
              console.warn("App: Inventory Errors Detected:", errors.length);
              setInventoryErrors(errors);
              // setShowErrorsModal(true); // Optional: Auto-open? No, just alert.
            }
          }
        }
      } catch (e) {
        console.error("App: Failed to load live inventory", e);
      }
    };

    loadLiveInventory();
    // console.warn("App: Live Inventory Loading DISABLED by user request.");
  }, []); // Run once on mount

  const handleUpdate = async (updated: Ubicacion | Ubicacion[]) => {
    // Intercept for USER role (Proposals)
    if (user?.role === 'USER') {
      const updates = Array.isArray(updated) ? updated : [updated];
      if (updates.length === 0) return;

      const token = localStorage.getItem('auth_token');
      if (!token) {
        alert("Error de sesión. Por favor, recarga.");
        return;
      }

      try {
        for (const u of updates) {
          await AssistantService.submitAction("ACTUALIZAR_UBICACION", {
            id: u.id, x: u.x, y: u.y, rotation: u.rotation,
            width: u.width, depth: u.depth
          }, token);
        }
        // Notify user
        // Ideally use a toast, but alert is fine for now/User requested notification
        const msg = document.createElement('div');
        msg.textContent = "⏳ Propuesta enviada a Admin";
        msg.style.cssText = "position:fixed;top:80px;right:20px;background:#ff9800;color:white;padding:10px 20px;border-radius:4px;z-index:9999;box-shadow:0 2px 5px rgba(0,0,0,0.2);animation:fadeout 3s forwards;";
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);

      } catch (e: any) {
        console.error(e);
        alert("Error al enviar propuesta: " + e.message);
      }
      return;
    }

    // Default Behavior (Admin / Local)
    const updates = Array.isArray(updated) ? updated : [updated];
    if (updates.length === 0) return;
    const nextUbicaciones = { ...state.ubicaciones };
    updates.forEach(u => { nextUbicaciones[u.id] = u; });
    pushState({ ...state, ubicaciones: nextUbicaciones });
  };

  // Range Selection Helper
  const resolveRange = (startId: string, endId: string) => {
    const allIds = Object.keys(state.ubicaciones).sort((a, b) => {
      const na = parseInt(a);
      const nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    const idx1 = allIds.indexOf(startId);
    const idx2 = allIds.indexOf(endId);
    if (idx1 === -1 || idx2 === -1) return [endId];
    const min = Math.min(idx1, idx2);
    const max = Math.max(idx1, idx2);
    return allIds.slice(min, max + 1);
  };

  const handleSelectLocation = (id: string | null, modifiers: { toggle?: boolean, range?: boolean } = {}) => {
    if (id === null) {
      // If we are in selection mode, clicking empty space might NOT clear selection? 
      // Usually users expect "click outside" to clear. Let's keep it clearing for now 
      // OR make it so only the explicit "Clear" button clears in mobile mode.
      // For now, standard behavior: click background -> clear.
      setSelectedIds(new Set());
      setLastFocusedId(null);
      return;
    }

    // Force toggle behavior if Selection Mode is active (and it's not a range select)
    const shouldToggle = modifiers.toggle || (isSelectionMode && !modifiers.range);

    if (modifiers.range && lastFocusedId) {
      const rangeIds = resolveRange(lastFocusedId, id);
      setSelectedIds(new Set(rangeIds));
    } else if (shouldToggle) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastFocusedId(id);
    } else {
      setSelectedIds(new Set([id]));
      setLastFocusedId(id);
    }
  };

  const handleCreatePallet = () => {
    const center = mapRef.current?.getViewCenter() || { x: 5, y: 10 };
    const allIds = Object.keys(state.ubicaciones).map(id => parseInt(id, 10)).filter(n => !isNaN(n));
    const nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
    const newPallet: Ubicacion = {
      id: nextId.toString(), tipo: 'palet', programa: 'Vacio', contenido: nextId.toString(),
      x: center.x, y: center.y, width: 0.8, depth: 1.2, rotation: 0
    };
    handleUpdate(newPallet);
  };

  const handleDeleteSelection = () => {
    if (selectedIds.size === 0) return;
    const newUbicaciones = { ...state.ubicaciones };
    let changed = false;
    selectedIds.forEach(id => {
      if (newUbicaciones[id]?.tipo === 'palet') {
        delete newUbicaciones[id];
        changed = true;
      }
    });
    if (changed) {
      pushState({ ...state, ubicaciones: newUbicaciones });
      setSelectedIds(new Set());
    }
  };

  // PRINT HANDLER
  const handlePrint = (options: PrintOptions) => {
    setShowPrintModal(false);

    // 1. Filter Data
    let dataToPrint: Ubicacion[] = [];
    const allUbicaciones = Object.values(state.ubicaciones);

    if (options.scope === 'ALL') {
      dataToPrint = allUbicaciones;
    } else if (options.scope === 'SELECTION') {
      dataToPrint = allUbicaciones.filter(u => selectedIds.has(u.id));
    } else if (options.scope === 'PROGRAM' && options.programString) {
      dataToPrint = allUbicaciones.filter(u => u.programa === options.programString);
    }

    // FILTER OUT STRUCTURAL ELEMENTS (Walls, Doors, Van)
    dataToPrint = dataToPrint.filter(u => u.tipo !== 'muro' && u.tipo !== 'puerta' && u.tipo !== 'zona_carga');

    if (dataToPrint.length === 0) {
      alert("No hay elementos para imprimir con la selección actual.");
      return;
    }

    // 2. Handle Format
    if (options.format === 'LIST' || options.format === 'CARDS') {
      setPrintData(dataToPrint);
      // PrintView will trigger window.print() on mount once rendered.
    } else {
      // MAP MODE
      document.body.classList.add('printing-map');
      setTimeout(() => {
        window.print();
        document.body.classList.remove('printing-map');
      }, 500);
    }
  };

  const handlePrintSingle = (loc: Ubicacion) => {
    setPrintData([loc]);
  };

  const selectedLocation = (selectedIds.size === 1) ? state.ubicaciones[Array.from(selectedIds)[0]] : null;

  if (isAdminOpen) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px', backgroundColor: '#009688', color: 'white', display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setIsAdminOpen(false)}
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', marginRight: '10px' }}
          >
            ← Volver al Mapa
          </button>
          <span style={{ fontWeight: 'bold' }}>SGA Eventos - Admin</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AdminDashboard />
        </div>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <div className="app-layer">
      {printData && (
        <PrintView data={printData} onClose={() => setPrintData(null)} />
      )}

      <div style={{ display: printData ? 'none' : 'block' }}>
        <AppShell
          header={
            <Header
              title="SGA Eventos v1.5.4"
              subtitle={isSyncing ? "Sincronizando..." : "Gestión de Almacén"}
              leftAction={
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Menu / Config (Left Side) - Empty for now */}
                </div>
              }
              rightAction={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

                  {/* Cloud Controls */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleLoadFromCloud(false)} disabled={isSyncing} className="icon-btn" title="Cargar">
                      <IconCloudDown size={20} />
                    </button>
                    <button onClick={handleSaveToCloud} disabled={isSyncing} className="icon-btn" title="Guardar">
                      <IconSave size={20} />
                    </button>
                    <button onClick={undo} disabled={!canUndo} className="icon-btn" title="Deshacer">
                      <IconUndo size={20} />
                    </button>
                    <button onClick={redo} disabled={!canRedo} className="icon-btn" title="Rehacer">
                      <IconRedo size={20} />
                    </button>
                  </div>

                  <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                  <QuickSearch
                    ubicaciones={state.ubicaciones}
                    onSelectLocation={(id) => handleSelectLocation(id)}
                  />

                  <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                  {/* Map Controls Group */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!isMobile && (
                      <button
                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                        className={`icon-btn ${isSelectionMode ? 'active' : ''}`}
                        title={isSelectionMode ? "Modo Selección Activo" : "Activar Selección Múltiple"}
                      >
                        <IconSelection active={isSelectionMode} size={20} />
                      </button>
                    )}

                    {!isMobile && (
                      <>
                        <button onClick={() => setShowPrintModal(true)} className="icon-btn" title="Imprimir">
                          <IconPrinter size={20} />
                        </button>

                        <button onClick={() => setShowGrid(!showGrid)} className="icon-btn" title="Rejilla">
                          <IconGrid active={showGrid} size={20} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* ADMIN BUTTON (Moved Here) */}
                  {user?.role === 'ADMIN' && (
                    <>
                      <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />
                      <button
                        onClick={() => setIsAdminOpen(true)}
                        className="icon-btn"
                        title="Panel Admin"
                        style={{ backgroundColor: '#FFD54F', color: '#333' }}
                      >
                        <IconShield color="#333" size={20} />
                      </button>
                      {/* CONFIG BUTTON (Moved Here next to Shield) */}
                      <button className="icon-btn" onClick={() => setShowConfig(true)} title="Configuración">
                        <IconSettings size={20} />
                      </button>
                    </>
                  )}

                  <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                  {/* User Menu (Avatar) */}
                  <UserMenu user={user} onLogout={logout} />
                </div>
              }
            />
          }

          main={
            <WarehouseMap
              ref={mapRef}
              ubicaciones={state.ubicaciones}
              onSelectLocation={handleSelectLocation}
              onSelectMultiple={(ids) => setSelectedIds(new Set(ids))}
              selectedIds={selectedIds}
              onUpdate={handleUpdate}
              geometry={state.geometry}
              onUpdateGeometry={(newGeo) => pushState({ ...state, geometry: newGeo })}
              rotationMode={isPortrait ? 'vertical-ccw' : 'normal'}
              showGrid={showGrid}
              onVisitorError={() => {
                setAssistantAlert("Solo puedes admirar el resultado de mi obra, si quieres usarlo tienes que pedir permiso al administrador");
              }}
              programColors={programColors}
              isMobile={isMobile}
              readOnly={isMobile && !isSelectionMode}
            />
          }
          footer={
            isMobile && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                pointerEvents: 'auto',
                zIndex: 900 // Ensure on top
              }}>
                {/* 1. Static Legend (Full Width) */}
                <DraggableLegend programColors={programColors} isMobile={true} />

                {/* 2. Toolbar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  padding: '6px 10px',
                  backgroundColor: '#f5f5f5',
                  borderTop: '1px solid #ddd',
                  boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
                  height: '60px'
                }}>
                  <button
                    onClick={() => setIsSelectionMode(!isSelectionMode)}
                    className={`icon-btn ${isSelectionMode ? 'active' : ''}`}
                    style={{
                      flexDirection: 'column',
                      gap: 2,
                      height: 'auto',
                      width: '60px',
                      color: isSelectionMode ? '#2E7D32' : '#555',
                      backgroundColor: isSelectionMode ? '#e8f5e9' : 'transparent',
                      border: isSelectionMode ? '1px solid #c8e6c9' : 'none'
                    }}
                  >
                    <IconSelection active={isSelectionMode} size={24} />
                    <span style={{ fontSize: '9px', fontWeight: 600 }}>Selección</span>
                  </button>

                  <button
                    onClick={() => setShowGrid(!showGrid)}
                    className="icon-btn"
                    style={{
                      flexDirection: 'column',
                      gap: 2,
                      height: 'auto',
                      width: '60px',
                      color: showGrid ? '#2E7D32' : '#555'
                    }}
                  >
                    <IconGrid active={showGrid} size={24} />
                    <span style={{ fontSize: '9px', fontWeight: 600 }}>Rejilla</span>
                  </button>

                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="icon-btn"
                    style={{
                      flexDirection: 'column',
                      gap: 2,
                      height: 'auto',
                      width: '60px',
                      color: '#555'
                    }}
                  >
                    <IconPrinter size={24} />
                    <span style={{ fontSize: '9px', fontWeight: 600 }}>Imprimir</span>
                  </button>
                </div>
              </div>
            )
          }
          overlay={
            <>
              {/* Modal de Configuración */}
              {showConfig && (
                <ConfigModal
                  initialColors={programColors}
                  scriptUrl={scriptUrl}
                  onSave={(newColors, newUrl) => {
                    console.log("💾 Almacenando Configuración:", newColors);
                    setProgramColors(newColors);
                    // Force immediate save to ensure it persists even if useEffect is slow
                    localStorage.setItem('program_colors_config', JSON.stringify(newColors));

                    setScriptUrl(newUrl);
                    localStorage.setItem('google_script_url', newUrl);

                    setShowConfig(false);
                    alert("✅ Configuración guardada correctamente.");
                  }}
                  onClose={() => setShowConfig(false)}
                />
              )}

              {showErrorsModal && <InventoryErrorsModal errors={inventoryErrors} onClose={() => setShowErrorsModal(false)} />}


              {/* Modal de Impresión */}
              {showPrintModal && (
                <PrintModal
                  isOpen={showPrintModal}
                  onClose={() => setShowPrintModal(false)}
                  onPrint={handlePrint}
                  programs={Object.keys(programColors)}
                  hasSelection={selectedIds.size > 0}
                />
              )}

              {/* Hidden Print View (for List Printing) duplicated removed */}

              {/* Hidden Print View */}
              {assistantAlert && (
                <AssistantAlert
                  message={assistantAlert}
                  onClose={() => setAssistantAlert(null)}
                />
              )}

              {/* Chatbot Window */}
              <AssistantChat
                ubicaciones={state.ubicaciones}
                selectedId={selectedLocation?.id}
                onSelectLocation={(id) => handleSelectLocation(id)}
                onUpdate={handleUpdate}
                isOpen={isChatbotOpen}
                onClose={() => setIsChatbotOpen(false)}
                initialAction={pendingAssistantAction}
                onClearAction={() => setPendingAssistantAction(null)}
              />

              {/* Panel de Propiedades (Legacy) */}
              {selectedLocation && !isSelectionMode && selectedLocation.id !== 'van_v3' && (
                <div style={{ position: 'absolute', bottom: 80, left: 20, right: 20, zIndex: 100 }}>
                  <PropertiesPanel
                    location={selectedLocation}
                    onUpdate={handleUpdate}
                    onClose={() => setSelectedIds(new Set())}
                    programColors={programColors}
                    onAssistantAction={(action) => {
                      setPendingAssistantAction(action);
                      setIsChatbotOpen(true);
                    }}
                    onPrint={handlePrintSingle}
                  />
                </div>
              )}

              {/* Asistente Flotante (Draggable) */}
              <animated.div
                ref={assistantRef}
                {...bindAssistantDrag()}
                style={{
                  position: 'fixed', // Use FIXED to stay on top of scroll
                  top: -35, // Moved UP even more (-35)
                  left: 90, // Moved LEFT to sit between gear and title
                  zIndex: 9999,
                  // Use transform for performance, but mapped from simple Spring values
                  x,
                  y,
                  touchAction: 'none',
                  cursor: 'grab',
                  pointerEvents: 'auto' // CRITICAL for overlay children
                }}
              >
                <AssistantCharacter
                  size="lg"
                  state={isChatbotOpen ? 'listening' : 'idle'}
                  // Remove onClick here, handled by bindAssistantDrag
                  hasNotification={false}
                />
              </animated.div>

              {/* Draggable Legend (UI Polish) - DESKTOP ONLY */}
              {!isMobile && <DraggableLegend programColors={programColors} />}

              {/* Controles Flotantes Secundarios (Lado Izquierdo) */}
              <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: 10 }}>
                <button
                  className="fab-btn"
                  onClick={handleCreatePallet}
                  title="Crear Palet"
                  style={{ background: 'var(--color-primary)', color: 'white', borderRadius: '50%', width: 48, height: 48, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                >
                  +
                </button>
                {selectedIds.size > 0 && (
                  <button
                    className="fab-btn"
                    onClick={handleDeleteSelection}
                    title="Eliminar"
                    style={{ background: 'var(--color-action)', color: 'white', borderRadius: '50%', width: 48, height: 48, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  >
                    🗑
                  </button>
                )}
              </div>
            </>
          }
        />
      </div>
    </div>
  );
}

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>;
  }

  if (!user) {
    return <LoginModal />;
  }

  return <AuthenticatedApp />;
}

export default App;
