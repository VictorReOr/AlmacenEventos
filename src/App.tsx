import React, { useState, useEffect, useRef } from 'react';

// Components
import { AppShell } from './components/Layout/AppShell';
import { Header } from './components/Layout/Header';
import { AssistantCharacter } from './components/Assistant/AssistantCharacter';
import { AssistantChat } from './components/Assistant/AssistantChat';
import WarehouseMap from './WarehouseMap';
import PropertiesPanel from './PropertiesPanel';
import { ConfigModal } from './ConfigModal';
import { QuickSearch } from './components/UI/QuickSearch';

// Logic & Types
import { PROGRAM_COLORS } from './types';
import type { Ubicacion, AlmacenState } from './types';
import { generateInitialState } from './data';
import type { WarehouseMapRef } from './WarehouseMap';
import { GoogleSheetsService } from './services/GoogleSheetsService';

// Styles
import './App.css';

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

function App() {
  console.log("App component mounting (Refactored)...");

  // --- STATE INITIALIZATION ---
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
  const mapRef = useRef<WarehouseMapRef>(null);

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
      alert(`¡Guardado OK! (${keys.length} items)`);
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

  const handleUpdate = (updated: Ubicacion | Ubicacion[]) => {
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
      setSelectedIds(new Set());
      setLastFocusedId(null);
      return;
    }
    if (modifiers.range && lastFocusedId) {
      const rangeIds = resolveRange(lastFocusedId, id);
      setSelectedIds(new Set(rangeIds));
    } else if (modifiers.toggle) {
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

  const selectedLocation = (selectedIds.size === 1) ? state.ubicaciones[Array.from(selectedIds)[0]] : null;

  // --- RENDER ---
  return (
    <div className="app-layer">
      <AppShell
        header={
          <Header
            title="SGA Eventos"
            subtitle={isSyncing ? "Sincronizando..." : "Gestión de Almacén"}
            leftAction={
              <button className="icon-btn" onClick={() => setShowConfig(true)} title="Configuración">
                ⚙️
              </button>
            }
            rightAction={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <QuickSearch
                  ubicaciones={state.ubicaciones}
                  onSelectLocation={(id) => handleSelectLocation(id)}
                />

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
            programColors={programColors}
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
            {selectedLocation && (
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

            {/* Asistente Flotante (Botón Principal) */}
            <div
              style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                zIndex: 200
              }}
            >
              <AssistantCharacter
                size="lg"
                state={isChatbotOpen ? 'listening' : 'idle'}
                onClick={() => setIsChatbotOpen(!isChatbotOpen)}
                hasNotification={false}
              />
            </div>

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

export default App;
