import React, { useState, useEffect } from 'react';

import WarehouseMap from './WarehouseMap';
import PropertiesPanel from './PropertiesPanel';
import { PROGRAM_COLORS } from './types';
import type { Ubicacion, AlmacenState } from './types';
import { generateInitialState } from './data';
import type { WarehouseMapRef } from './WarehouseMap';
import { GoogleSheetsService } from './services/GoogleSheetsService';
import { ConfigModal } from './ConfigModal';
import { Chatbot } from './components/Chatbot';
import almacenitoIcon from './assets/almacenito.png';
import './App.css';



// --- HISTORY HOOK ---
const useHistory = (initialState: AlmacenState) => {
  const [history, setHistory] = useState<AlmacenState[]>([initialState]);
  const [pointer, setPointer] = useState(0);

  const currentState = history[pointer];

  const pushState = (newState: AlmacenState) => {
    const nextHistory = [...history.slice(0, pointer + 1), newState];
    // Limit history to 50
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

// --- TOOLBAR COMPONENT ---
interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAlignRow: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  selectedId: string | null;
  onCreatePallet: () => void;
  onDeleteSelection: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onUndo, onRedo, canUndo, canRedo,
  onAlignRow, onRotateLeft, onRotateRight, selectedId,
  onCreatePallet, onDeleteSelection
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button onClick={onUndo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
          ↩ Deshacer
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Rehacer (Ctrl+Y)">
          ↪ Rehacer
        </button>
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <button onClick={onRotateLeft} disabled={!selectedId} title="Rotar -90º">
          ↺ -90º
        </button>
        <button onClick={onRotateRight} disabled={!selectedId} title="Rotar +90º">
          ↻ +90º
        </button>
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <button onClick={onAlignRow} disabled={!selectedId} title="Alinear Fila">
          ⇥ Alinear Fila
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button onClick={onCreatePallet} title="Crear Palet (N)">
          ➕ Palet
        </button>
        <button onClick={onDeleteSelection} disabled={!selectedId} title="Eliminar Palets (Supr)" style={selectedId ? { color: '#ef5350' } : {}}>
          🗑 Elimin
        </button>
      </div>
    </div>
  );
};

function App() {
  console.log("App component mounting...");
  // Initialize state generator (once)
  const getInitialState = () => {
    try {
      console.log("Generating initial state...");
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
      // Fallback
      const codeState = generateInitialState();
      return { ubicaciones: codeState.ubicaciones, geometry: codeState.geometry };
    }
  };

  const { state, pushState, undo, redo, canUndo, canRedo } = useHistory(getInitialState());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isChatbotOpen, setIsChatbotOpen] = useState(false); // Chatbot State
  // Logo Drag State
  const [lastFocusedId, setLastFocusedId] = useState<string | null>(null);
  const mapRef = React.useRef<WarehouseMapRef>(null);

  // --- VERTICAL LAYOUT DETECTION ---
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  // --- GOOGLE CLOUD CONFIG ---
  const [scriptUrl, setScriptUrl] = useState<string>(() => localStorage.getItem('google_script_url') || 'https://script.google.com/macros/s/AKfycbz9141Mcq2DNiMmFlE372Y_FXJvSa1FWWVQyP4ptCRn2H1YAUGxV9puZFGFChOWLV0/exec');
  const [isSyncing, setIsSyncing] = useState(false);

  // --- ADVANCED GRID STATE ---
  const [showGrid, setShowGrid] = useState(false);

  // --- CONFIG / COLORS STATE ---
  const [programColors, setProgramColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('program_colors_config');
    return saved ? JSON.parse(saved) : PROGRAM_COLORS;
  });
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    localStorage.setItem('google_script_url', scriptUrl);
  }, [scriptUrl]);

  useEffect(() => {
    localStorage.setItem('warehouse_V73.1_SHELVES_FIX', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem('program_colors_config', JSON.stringify(programColors));
  }, [programColors]);


  // Handle Cloud Save/Load
  const handleSaveToCloud = async () => {
    if (!scriptUrl) {
      setShowConfig(true);
      return;
    }
    setIsSyncing(true);
    try {
      const targetUrl = scriptUrl;
      await GoogleSheetsService.save(targetUrl, state);
      alert('¡Guardado en Google Sheets con éxito!');
    } catch (error) {
      console.error(error);
      alert('Error al guardar: ' + error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadFromCloud = async () => {
    if (!scriptUrl) {
      setShowConfig(true);
      return;
    }
    if (!confirm("¿Seguro que quieres cargar desde la nube? Se sobrescribirán los cambios no guardados.")) return;

    setIsSyncing(true);
    try {
      const data = await GoogleSheetsService.load(scriptUrl);
      if (data) {
        pushState(data);
        alert('¡Cargado desde Google Sheets con éxito!');
      } else {
        alert('La hoja parece estar vacía o hubo un problema.');
      }
    } catch (error) {
      console.error(error);
      alert('Error al cargar: ' + error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveConfig = (newColors: Record<string, string>, newScriptUrl: string) => {
    setProgramColors(newColors);
    setScriptUrl(newScriptUrl);
  };


  // Handle Updates
  const handleUpdate = (updated: Ubicacion | Ubicacion[]) => {
    const updates = Array.isArray(updated) ? updated : [updated];
    if (updates.length === 0) return;

    const nextUbicaciones = { ...state.ubicaciones };
    updates.forEach(u => {
      nextUbicaciones[u.id] = u;
    });

    pushState({
      ...state,
      ubicaciones: nextUbicaciones
    });
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

  const selectedLocation = (selectedIds.size === 1) ? state.ubicaciones[Array.from(selectedIds)[0]] : null;

  // --- ACTIONS ---

  const handleCreatePallet = () => {
    const center = mapRef.current?.getViewCenter() || { x: 5, y: 10 };
    const allIds = Object.keys(state.ubicaciones)
      .map(id => parseInt(id, 10))
      .filter(n => !isNaN(n));

    const nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;

    const newPallet: Ubicacion = {
      id: nextId.toString(),
      tipo: 'palet',
      programa: 'Vacio',
      contenido: nextId.toString(),
      x: center.x,
      y: center.y,
      width: 0.8,
      depth: 1.2,
      rotation: 0
    };

    const nextUbicaciones = { ...state.ubicaciones, [newPallet.id]: newPallet };
    const newState = { ...state, ubicaciones: nextUbicaciones };

    pushState(newState);
  };

  const handleDeleteSelection = () => {
    if (selectedIds.size === 0) return;

    const newUbicaciones = { ...state.ubicaciones };
    let changed = false;

    selectedIds.forEach(id => {
      const u = newUbicaciones[id];
      if (u && u.tipo === 'palet') {
        delete newUbicaciones[id];
        changed = true;
      }
    });

    if (changed) {
      const newState = { ...state, ubicaciones: newUbicaciones };
      pushState(newState);
      setSelectedIds(new Set());
    }
  };

  // Keyboard Movement
  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (selectedIds.size === 0) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.05;
        let dx = 0;
        let dy = 0;

        switch (e.key) {
          case 'ArrowUp': dx = -step; break;
          case 'ArrowDown': dx = step; break;
          case 'ArrowLeft': dy = -step; break;
          case 'ArrowRight': dy = step; break;
        }

        const updates: Ubicacion[] = [];
        selectedIds.forEach(id => {
          const u = state.ubicaciones[id];
          if (u) {
            updates.push({ ...u, x: u.x + dx, y: u.y + dy });
          }
        });
        handleUpdate(updates);
      }
    };

    window.addEventListener('keydown', handleArrowKeys);
    return () => window.removeEventListener('keydown', handleArrowKeys);
  }, [selectedIds, state.ubicaciones]);

  const handleRotate = (deg: number) => {
    if (selectedIds.size === 0) return;
    const updates: Ubicacion[] = [];
    selectedIds.forEach(id => {
      const u = state.ubicaciones[id];
      if (u) {
        updates.push({ ...u, rotation: (u.rotation + deg) % 360 });
      }
    });
    handleUpdate(updates);
  };

  const handleAlignRow = () => {
    if (!selectedLocation) return;
    const targetX = selectedLocation.x;
    const targetRot = selectedLocation.rotation;

    const candidates = Object.values(state.ubicaciones).filter(u =>
      u.tipo === 'palet' &&
      u.id !== selectedLocation.id &&
      Math.abs(u.rotation - targetRot) < 5 &&
      Math.abs(u.x - targetX) < 1.0
    );

    if (candidates.length === 0) return;

    const newUbicaciones = { ...state.ubicaciones };
    let changed = false;

    candidates.forEach(c => {
      newUbicaciones[c.id] = { ...c, x: targetX, rotation: targetRot };
      changed = true;
    });

    if (changed) {
      pushState({ ...state, ubicaciones: newUbicaciones });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);



  return (
    <div className="app-container">
      {/* CONFIG MODAL */}
      {showConfig && (
        <ConfigModal
          initialColors={programColors}
          scriptUrl={scriptUrl}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}

      {/* CHATBOT */}
      <Chatbot
        ubicaciones={state.ubicaciones}
        onSelectLocation={(id) => handleSelectLocation(id, { toggle: true })}
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
      />

      {/* FLOATING HEADER */}
      <div className="app-header">

        {/* LEFT: Almacenito Logo (Image - Fixed Position) */}
        <div
          style={{
            width: 120,
            height: 50,
            position: 'relative',
            zIndex: 3000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <img
            src={almacenitoIcon}
            alt="Almacenito"
            className="header-logo-hover"
            onClick={() => setIsChatbotOpen(!isChatbotOpen)}
            style={{
              width: 350,
              height: 350,
              objectFit: 'contain',
              position: 'absolute',
              // Fixed Coordinates
              top: isPortrait ? -85 : -84,
              left: isPortrait ? -77 : -20,
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              pointerEvents: 'auto'
            }}
          />
        </div>

        <div style={{ flex: 1 }} /> {/* Spacer to push everything else to right */}

        {!isPortrait && (
          <div className="header-separator" style={{ height: 60, margin: '0 20px', backgroundColor: 'rgba(255,255,255,0.3)' }} />
        )}

        {/* RIGHT: Stacked Legend & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: isPortrait ? 'center' : 'flex-end', overflow: 'hidden' }}>

          {/* Row 1: Legend (Single Line) */}
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: isPortrait ? 'center' : 'flex-end',
            flexWrap: isPortrait ? 'wrap' : 'nowrap',
            overflowX: isPortrait ? 'visible' : 'auto',
            maxWidth: '100%',
            paddingBottom: '4px',
            scrollbarWidth: 'none'
          }}>
            {Object.entries(programColors).map(([prog, color]) => (
              <div key={prog} className="legend-item" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span className="color-box" style={{ background: color }}></span>
                <span>{prog}</span>
              </div>
            ))}
          </div>

          {/* Row 2: Controls */}
          <div className="header-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: isPortrait ? 'center' : 'flex-end' }}>
            <button className="print-btn" onClick={() => window.print()} title="Imprimir">
              🖨️
            </button>

            <button className="print-btn" onClick={handleLoadFromCloud} disabled={isSyncing} title="Cargar">
              ☁️
            </button>

            <button className="print-btn" onClick={handleSaveToCloud} disabled={isSyncing} title="Guardar">
              {isSyncing ? '...' : '💾'}
            </button>

            <button
              className="print-btn"
              onClick={() => setShowGrid(!showGrid)}
              title={showGrid ? "Ocultar Rejilla" : "Mostrar Rejilla"}
            >
              {showGrid ? '▦' : '□'}
            </button>

            <button className="print-btn" onClick={() => setShowConfig(true)}>⚙️</button>

            <button className="print-btn" onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}>📺</button>
          </div>

        </div>
      </div>

      <div className="main-content">
        <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <WarehouseMap
            ref={mapRef}
            ubicaciones={state.ubicaciones}
            onSelectLocation={handleSelectLocation}
            onSelectMultiple={(ids) => setSelectedIds(new Set(ids))}
            selectedIds={selectedIds}
            onUpdate={handleUpdate}
            geometry={state.geometry}
            onUpdateGeometry={(newGeo) => {
              pushState({ ...state, geometry: newGeo });
            }}
            rotationMode={isPortrait ? 'vertical-ccw' : 'normal'}
            showGrid={showGrid}
            programColors={programColors}
          />
        </main>

        {selectedLocation && (
          <PropertiesPanel
            location={selectedLocation}
            onUpdate={handleUpdate}
            onClose={() => setSelectedIds(new Set())}
            programColors={programColors}
          />
        )}
      </div>

      <div style={{ borderTop: '1px solid #ccc', zIndex: 10, background: 'white' }}>
        <Toolbar
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onAlignRow={handleAlignRow}
          onRotateLeft={() => handleRotate(-90)}
          onRotateRight={() => handleRotate(90)}
          selectedId={selectedIds.size > 0 ? Array.from(selectedIds)[0] : null}
          onCreatePallet={handleCreatePallet}
          onDeleteSelection={handleDeleteSelection}
        />
      </div>
    </div>
  );
}
export default App;


