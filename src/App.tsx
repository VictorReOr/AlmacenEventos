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

// Logic & Types
import { PROGRAM_COLORS } from './types';
import type { Ubicacion, AlmacenState } from './types';
import { generateInitialState } from './data';
import type { WarehouseMapRef } from './WarehouseMap';
import { GoogleSheetsService } from './services/GoogleSheetsService';
import { AssistantService } from './services/AssistantService';

// Styles
import './App.css';

import './styles/print.css';
import { useIsMobile } from './hooks/useIsMobile';

// --- HISTORY HOOK ---
const useHistory = (initialState: AlmacenState) => {
  const [history, setHistory] = useState<AlmacenState[]>([initialState]);
  const [pointer, setPointer] = useState(0);

  const currentState = history[pointer];

  const pushState = (newState: AlmacenState) => {
    const nextHistory = [...history.slice(0, pointer + 1), newState];
    if (nextHistory.length > 50) nextHistory.shift();
    setHistory(nextHistory);
    setPointer(nextHistory.length - 1);
  };

  const undo = () => {
    if (pointer > 0) setPointer(pointer - 1);
  };

  const redo = () => {
    if (pointer < history.length - 1) setPointer(pointer + 1);
  };

  return { state: currentState, pushState, undo, redo, canUndo: pointer > 0, canRedo: pointer < history.length - 1 };
};

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
      const saved = localStorage.getItem('warehouse_V72_VERTICAL');
      const codeState = generateInitialState();
      const defaults = { ubicaciones: codeState.ubicaciones, geometry: codeState.geometry };

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            ...defaults,
            ...parsed,
            ubicaciones: { ...codeState.ubicaciones, ...parsed.ubicaciones },
            geometry: codeState.geometry
          };
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
  const { user, logout } = useAuth(); // Added logout
  const mapRef = useRef<WarehouseMapRef>(null);

  // Assistant Position (Draggable)
  const assistantRef = useRef<HTMLDivElement>(null);
  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }));

  // Fix: Use function for bounds to allow dynamic recalculation on window resize
  const bindAssistantDrag = useDrag(({ offset: [ox, oy], tap }) => {
    if (tap) {
      setIsChatbotOpen(prev => !prev);
    } else {
      api.start({ x: ox, y: oy });
    }
  }, {
    from: () => [x.get(), y.get()],
    // Dynamic bounds: Measure actual element size to be responsive-safe
    bounds: () => {
      // Relaxed bounds to prevent sticking
      return {
        left: -window.innerWidth * 1.2,
        right: 50,
        top: -window.innerHeight * 1.2,
        bottom: 50
      };
    },
    rubberband: true,
    filterTaps: true
  });
  // Layout Detection
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync & Config
  const [scriptUrl, setScriptUrl] = useState<string>(() => localStorage.getItem('google_script_url') || 'https://script.google.com/macros/s/AKfycbz3PM-qshUZDMRJBm5YdfrLJIhUjrYW9Jet1R8KDtvoMydhx9y92ZeP_iJ_oyhnw0MP/exec');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [programColors, setProgramColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('program_colors_config');
    return saved ? JSON.parse(saved) : PROGRAM_COLORS;
  });

  // Print State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<Ubicacion[] | null>(null);



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

  const handleLoadFromCloud = async () => {
    if (!scriptUrl) { setShowConfig(true); return; }
    if (!confirm("Se sobrescribirán los cambios locales. ¿Continuar?")) return;
    setIsSyncing(true);
    try {
      const data = await GoogleSheetsService.load(scriptUrl);
      if (data) { pushState(data); alert('¡Cargado con éxito!'); }
      else { alert('Error: Datos vacíos.'); }
    } catch (error) {
      console.error(error);
      alert('Error: ' + error);
    } finally { setIsSyncing(false); }
  };

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

    if (dataToPrint.length === 0) {
      alert("No hay elementos para imprimir con la selección actual.");
      return;
    }

    // 2. Handle Format
    if (options.format === 'LIST') {
      setPrintData(dataToPrint);
      // Give React a moment to render the PrintView before triggering print
      setTimeout(() => {
        window.print();
        setPrintData(null); // Clear after print dialog closes
      }, 500);
    } else {
      // MAP MODE
      document.body.classList.add('printing-map');
      setTimeout(() => {
        window.print();
        document.body.classList.remove('printing-map');
      }, 500);
    }
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
      {/* PRINT VIEW CONTAINER (Only visible during print list mode) */}
      {printData && (
        <PrintView data={printData} />
      )}

      <AppShell
        header={
          <Header
            title="SGA Eventos"
            subtitle={isSyncing ? "Sincronizando..." : "Gestión de Almacén"}
            leftAction={
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="icon-btn" onClick={() => setShowConfig(true)} title="Configuración">
                  ⚙️
                </button>
                <button
                  className="icon-btn"
                  onClick={logout}
                  title="Cerrar Sesión"
                  style={{ backgroundColor: '#ffcccc', color: '#cc0000' }}
                >
                  🚪
                </button>
              </div>
            }
            rightAction={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => setIsAdminOpen(true)}
                    className="icon-btn"
                    title="Panel Admin"
                    style={{ backgroundColor: '#FFD54F', color: '#333' }}
                  >
                    🛡️ Admin
                  </button>
                )}
                <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                <QuickSearch
                  ubicaciones={state.ubicaciones}
                  onSelectLocation={(id) => handleSelectLocation(id)}
                />

                <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                {/* Selection Mode Toggle */}
                <button
                  onClick={() => setIsSelectionMode(!isSelectionMode)}
                  className={`icon-btn ${isSelectionMode ? 'active' : ''}`}
                  title={isSelectionMode ? "Modo Selección Activo (Clic para desactivar)" : "Activar Modo Selección Múltiple"}
                >
                  {isSelectionMode ? '☑️' : '☐'}
                </button>




                <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                <button onClick={() => setShowPrintModal(true)} className="icon-btn" title="Imprimir Inventario">
                  🖨️
                </button>
                <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                <button onClick={() => setShowGrid(!showGrid)} className="icon-btn" title="Rejilla">
                  {showGrid ? '▦' : '□'}
                </button>
                <button onClick={handleLoadFromCloud} disabled={isSyncing} className="icon-btn" title="Cargar">☁️</button>
                <button onClick={handleSaveToCloud} disabled={isSyncing} className="icon-btn" title="Guardar">💾</button>
                <button onClick={undo} disabled={!canUndo} className="icon-btn" title="Deshacer">↩</button>
                <button onClick={redo} disabled={!canRedo} className="icon-btn" title="Rehacer">↪</button>
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
          />
        }
        overlay={
          <>
            {/* Modal de Configuración */}
            {showConfig && (
              <ConfigModal
                initialColors={programColors}
                scriptUrl={scriptUrl}
                onSave={(colors, url) => {
                  setProgramColors(colors);
                  setScriptUrl(url);
                  setShowConfig(false);
                }}
                onClose={() => setShowConfig(false)}
              />
            )}

            {assistantAlert && (
              <AssistantAlert
                message={assistantAlert}
                onClose={() => setAssistantAlert(null)}
              />
            )}

            {/* Modal de Impresión */}
            <PrintModal
              isOpen={showPrintModal}
              onClose={() => setShowPrintModal(false)}
              onPrint={handlePrint}
              programs={Object.keys(programColors).filter(p => !['Vacio', 'Otros'].includes(p))}
              hasSelection={selectedIds.size > 0}
            />

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
            {selectedLocation && !isSelectionMode && (
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
                />
              </div>
            )}

            {/* Asistente Flotante (Draggable) */}
            <animated.div
              ref={assistantRef}
              {...bindAssistantDrag()}
              style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                zIndex: 9999, // CRITICAL: Always on top of everything
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
