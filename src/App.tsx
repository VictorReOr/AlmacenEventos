import { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginModal } from './components/Login/LoginModal';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';

// Componentes
import { AppShell } from './components/Layout/AppShell';
import { Header } from './components/Layout/Header';
import { AssistantCharacter } from './components/Assistant/AssistantCharacter';
import { AssistantChat } from './components/Assistant/AssistantChat';
import { AssistantAlert } from './components/Assistant/AssistantAlert';
import WarehouseMap from './WarehouseMap';
import { WarehouseMap3D } from './components/Map3D/WarehouseMap3D';
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

// Lógica y Tipos
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

// Estilos
import './App.css';

import './styles/print.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useIsMobile } from './hooks/useIsMobile';

// --- HOOK DE HISTORIAL ---
import { useHistory } from './hooks/useHistory';

// Definición local de useHistory eliminada


function AuthenticatedApp() {
  // Los comentarios siguientes eran parte del componente App original, ahora movidos a AuthenticatedApp
  // ¿Usar hooks antes del retorno condicional para evitar violar la Regla de Hooks?
  // Espera, si retorno anticipadamente, los hooks de abajo no se ejecutarán. Eso es una violación.
  // Debo mover todos los hooks arriba O mover la lógica de Autenticación a un componente envoltorio (wrapper).
  // Convertir App a un envoltorio RequireAuth es más limpio, pero App tiene lógica de estado compleja.
  // ¿Usar un sub-componente?
  // Asumamos que el estado de carga (loading) está manejado.
  // Pero useHistory es un hook.

  // Refactorización:
  // AppContent = contenido original de App
  // App = Envoltorio con comprobación de Autenticación.

  // En realidad, podría inicializar useHistory y otros, PERO si retorno anticipadamente, 
  // los renderizados subsiguientes deben coincidir en el orden de los hooks.
  // Si isLoading cambia de true a false, los hooks son consistentes (si los llamo todos).
  // ¿Pero si !user retorna, me salto hooks?
  // NO. `if (!user)` es un retorno. Debajo hay hooks.
  // Si hay usuario (user), los hooks se ejecutan.
  // React requiere que el MISMO número de hooks se ejecute en el MISMO orden en cada renderizado.

  // Así que NO PUEDO retornar anticipadamente antes de los hooks si la condición cambia.
  // `isLoading` empieza true, luego cambia a false. La condición cambia. ¿Los hooks de abajo fallan?
  // Sí.

  // Solución: Renombrar `App` a `AuthenticatedApp` y crear un nuevo `App` que maneja la Autenticación.

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

          // Validar Datos Parseados
          const hasGeo = parsed.geometry && Array.isArray(parsed.geometry) && parsed.geometry.length > 0;
          const hasObjs = parsed.ubicaciones && Object.keys(parsed.ubicaciones).length > 0;

          if (!hasGeo && !hasObjs) {
            console.warn("⚠️ Saved state is empty/invalid. Reverting to DEFAULTS.");
            return defaults;
          }

          // Lógica de Fusión (Merge)
          let mergedUbicaciones = hasObjs ? { ...codeState.ubicaciones, ...parsed.ubicaciones } : codeState.ubicaciones;

          // --- SUPREMACÍA DEL CÓDIGO: DELEGAR EN CLEANUP.TS ---
          // Esto impone que solo los objetos definidos en data.ts (Impolares) existan.
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
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  console.log("AuthenticatedApp: useAuth() called");
  const { user, logout } = useAuth(); // Añadido cierre de sesión (logout)
  const mapRef = useRef<WarehouseMapRef>(null);

  // Modo Vista 3D
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');

  // Posición del Asistente (Arrastrable)
  const assistantRef = useRef<HTMLDivElement>(null);
  // Posición Persistente
  const [assistantPos, setAssistantPos] = useLocalStorage<{ x: number, y: number }>('assistant_pos_v5', { x: 0, y: 0 });

  // Inicializar spring desde el almacenamiento
  const [{ x, y }, api] = useSpring(() => ({ x: assistantPos.x, y: assistantPos.y }));

  const bindAssistantDrag = useDrag(({ offset: [ox, oy], tap, down, last }) => {
    if (tap) {
      if (!down) setIsChatbotOpen(prev => !prev);
    } else {
      // Mapeo directo de offset a x/y.
      api.start({ x: ox, y: oy, immediate: down });
      if (last) {
        setAssistantPos({ x: ox, y: oy });
      }
    }
  }, {
    // Empezar desde los valores actuales
    from: () => [x.get(), y.get()],
    filterTaps: true,
    rubberband: true
  });

  // DEBUG: Mostrar Alerta con URL de API al montar para verificar ruta de conexión
  useEffect(() => {
    // console.log("🔌 Conectando a:", config.API_BASE_URL);
  }, []);
  // Detección de Diseño (Layout)
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sincronización y Configuración
  const [scriptUrl, setScriptUrl] = useState<string>(() => localStorage.getItem('google_script_url') || 'https://script.google.com/macros/s/AKfycbwPJThfJGQXx1J-TnRHtgZlh_TmrpZXBvMDTyomvy6BOnL9ebuZuYmt_ZH4hQ74DiAh/exec');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [editMapMode, setEditMapMode] = useState(false); // Nivel Dios: Editar Geometría
  const [programColors, setProgramColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('program_colors_config');
    console.log("App: Initializing programColors. Saved:", saved ? "YES" : "NO", saved);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Mezclar colores guardados, pero FORZAR los nuevos PROGRAM_COLORS como base para asegurar que las nuevas claves y colores se apliquen.
        // Si queremos que las personalizaciones del usuario sobrevivan, hacemos { ...PROGRAM_COLORS, ...parsed }
        // Pero dado que acabamos de actualizar la paleta por defecto, queremos asegurarnos de que la vean.
        // Mezclémoslos para que aparezcan las nuevas claves. Si tenían un viejo 'Material Deportivo', lo sobrescribimos con la nueva definición.
        // En realidad, la forma más limpia de garantizar los nuevos colores base pero permitir cierta modificación es simplemente aplicar PROGRAM_COLORS.
        // Por ahora, para garantizar la actualización solicitada:
        const merged = { ...parsed, ...PROGRAM_COLORS };
        return merged;
      } catch (e) {
        return PROGRAM_COLORS;
      }
    }
    return PROGRAM_COLORS;
  });

  useEffect(() => {
    console.log("App: Persisting programColors to localStorage:", programColors);
    localStorage.setItem('program_colors_config', JSON.stringify(programColors));
  }, [programColors]);

  // Estado de Impresión
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<Ubicacion[] | null>(null);

  // Estado de Validación
  const [inventoryErrors, setInventoryErrors] = useState<InventoryError[]>([]);
  const [showErrorsModal, setShowErrorsModal] = useState(false);
  const [showLegendModal, setShowLegendModal] = useState(false);



  const [isSelectionMode, setIsSelectionMode] = useState(false); // Nuevo estado para selección en móviles
  const [isEditModeGlobal, setIsEditModeGlobal] = useState(false); // NUEVO: Bloqueo global de Drag and Drop
  const isMobile = useIsMobile();

  // Efectos
  useEffect(() => { localStorage.setItem('google_script_url', scriptUrl); }, [scriptUrl]);
  useEffect(() => { localStorage.setItem('warehouse_V73.1_SHELVES_FIX', JSON.stringify(state)); }, [state]);
  useEffect(() => { localStorage.setItem('program_colors_config', JSON.stringify(programColors)); }, [programColors]);

  // --- MANEJADORES (Igual que antes) ---
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

  const handleExportDataTS = () => {
    try {
      // Recreamos paso a paso el archivo original data.ts basándonos en el estado actual
      const geoStr = JSON.stringify(state.geometry, null, 8).replace(/"x"/g, 'x').replace(/"y"/g, 'y');

      const ubicacionesStrBuilder: string[] = [];
      Object.keys(state.ubicaciones).forEach(key => {
        const item = state.ubicaciones[key];

        // Eliminamos las piezas inventariadas que son dinámicas para no "cocinarlas" dentro del código base
        const cleanItem = {
          id: item.id,
          tipo: item.tipo,
          programa: "Vacio",
          contenido: item.id,
          x: item.x,
          y: item.y,
          rotation: item.rotation,
          width: item.width,
          depth: item.depth,
          ...(item.estanteriaId !== undefined && { estanteriaId: item.estanteriaId }),
          ...(item.mensaje !== undefined && { mensaje: item.mensaje }),
          ...(item.labelX !== undefined && { labelX: item.labelX }),
          ...(item.labelY !== undefined && { labelY: item.labelY }),
          ...(item.labelRot !== undefined && { labelRot: item.labelRot }),
          ...(item.labelXV !== undefined && { labelXV: item.labelXV }),
          ...(item.labelYV !== undefined && { labelYV: item.labelYV }),
        };

        const json = JSON.stringify(cleanItem, null, 12)
          .replace(/"([^"]+)":/g, '$1:');
        ubicacionesStrBuilder.push(`        "${key}": ${json}`);
      });

      const fileContent = `import type { Ubicacion, Caja } from './types';
import { INITIAL_INVENTORY_UPDATES } from './initialInventory';

export const SHELF_MODULE_WIDTH = 1.0;
export const SHELF_DEPTH = 0.45;

const generateDummyBox = (id: string, program: string): Caja => {
    return {
        id: \`BOX-\${id}-\${Math.floor(Math.random() * 1000)}\`,
        descripcion: \`Caja \${id}\`,
        programa: program,
        contenido: [
            { id: crypto.randomUUID(), materialId: 'm1', nombre: 'Material Genérico', cantidad: 5, estado: 'operativo' }
        ]
    };
};

export const generateInitialState = (): { ubicaciones: Record<string, Ubicacion>, geometry: { x: number; y: number }[] } => {

    const geometryFinal = ${geoStr};

    const ubicaciones: Record<string, Ubicacion> = {
${ubicacionesStrBuilder.join(',\n')}
    };

    return { ubicaciones, geometry: geometryFinal };
};
`;

      const blob = new Blob([fileContent], { type: 'text/typescript;charset=utf-8' });
      const dlNode = document.createElement('a');
      dlNode.href = URL.createObjectURL(blob);
      dlNode.download = 'data.ts';
      document.body.appendChild(dlNode);
      dlNode.click();
      document.body.removeChild(dlNode);
    } catch (e) {
      console.error("Error exporting data.ts", e);
      alert('Hubo un error al generar la exportación.');
    }
  };

  const handleLoadFromCloud = async (silent = false) => {
    if (!scriptUrl) { setShowConfig(true); return; }
    if (!silent && !confirm("Se sobrescribirán los cambios locales. ¿Continuar?")) return;
    setIsSyncing(true);
    try {
      // Pasar los valores por defecto del código como estado base para que el servicio pueda poblarlo con el inventario de la nube
      const defaults = generateInitialState();
      const baseState = { ubicaciones: defaults.ubicaciones, geometry: defaults.geometry };

      const data = await GoogleSheetsService.load(scriptUrl, baseState);

      if (data) {
        // Validación: No aceptar geometría vacía de la nube
        if (!data.geometry || data.geometry.length === 0) {
          console.warn("Cloud data has no geometry. Ignoring.");
          if (!silent) alert('Error: Datos de nube corruptos o vacíos (sin geometría).');
          return;
        }

        // --- LIMPIAR (SANITIZE) DATOS DE LA NUBE ---
        // Previene que regresen fantasmas del ConfigJson
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


  // ... importaciones existentes ...

  // Dentro de AuthenticatedApp:

  // Auto-Carga al inicio -> DESACTIVADO para evitar sobrescribir datos locales con datos de nube vacíos
  // Auto-Load on mount
  // Auto-Carga al inicio -> DESACTIVADO (Usamos loadLiveInventory más abajo)
  /*
  useEffect(() => {
    if (scriptUrl) {
      console.log("Auto-loading from cloud...");
      handleLoadFromCloud(true);
    }
  }, []);
  */

  // --- AUDITOR DE ESTADO: CAZADOR DE FANTASMAS ---
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

  // --- NUEVO: Cargar Inventario desde el Backend (Google Sheets) ---
  useEffect(() => {
    const loadLiveInventory = async () => {
      console.warn("App: loadLiveInventory() STARTED 🏁");
      try {
        console.warn("App: Fetching live inventory...");
        const rawData = await InventoryService.fetchInventory();
        console.log("App: Fetch returned! 📦", rawData ? rawData.length : "NULL");

        if (rawData && rawData.length > 0) {
          console.log("App: Parsing inventory...");
          const updates = InventoryService.parseInventoryToState(rawData);
          console.warn(`App: Raw Inventory Items: ${rawData.length}`);
          console.warn("App: Parsed updates keys:", Object.keys(updates));

          // Fusionar actualizaciones en el estado actual
          // Usamos la forma de función del setter de estado si es posible, pero aquí tenemos `state` desde useHistory
          // Debemos tener cuidado de no crear una condición de carrera si ocurren actualizaciones de estado simples.
          // Dado que esto se ejecuta una vez al montar, debería estar bien usar el `state` actual.
          // Sin embargo, `state` en el array de dependencias causaría un bucle.
          // ¿Usamos un ref o solo `handleUpdate` si se fusionó? 
          // `handleUpdate` usa `state` desde el closure.

          // Mejor: ¿Crear una función de fusión dedicada que use el *último* estado si está dentro de useEffect?
          // En realidad, `handleUpdate` está definida en el ámbito de renderizado, por lo que hace closure sobre `state`.
          // Si la llamamos, usa `state` en el momento de renderizado (momento de montaje).
          // Lo cual está bien porque nada más lo actualiza todavía.

          // Nota: `handleUpdate` espera un array de Ubicacion. 
          // Nuestras `updates` son Record<string, Partial<Ubicacion>>.
          // Necesitamos convertirlo.

          const fullUpdates: Ubicacion[] = [];
          const currentUbicaciones = state.ubicaciones; // Estado del closure

          // 1. LIMPIAR INVENTARIO EXISTENTE (Prevenir Fantasmas)
          // Creamos una nueva actualización para CADA objeto en el estado para limpiar su inventario
          const clearedUbicaciones: Record<string, Ubicacion> = {};

          Object.values(currentUbicaciones).forEach(u => {
            // Crear un objeto base con campos de inventario LIMPIADOS
            clearedUbicaciones[u.id] = {
              ...u,
              cajas: [],
              materiales: [],
              items: [], // Heredado (Legacy)
              shelfItems: {},
              cajasEstanteria: {},
              niveles: u.niveles ? u.niveles.map(l => ({ ...l, items: [] })) : undefined,
              contenido: u.tipo === 'palet' ? '' : u.contenido, // Mantener etiquetas estructurales
              programa: u.tipo === 'palet' ? 'Vacio' as any : u.programa
            };
          });

          // 2. APLICAR ACTUALIZACIONES FRESCAS
          Object.entries(updates).forEach(([id, partial]) => {
            const realId = Object.keys(clearedUbicaciones).find(k => k.toLowerCase() === id.toLowerCase());
            if (realId) {
              // Fusionar la actualización parcial en el objeto LIMPIO
              clearedUbicaciones[realId] = { ...clearedUbicaciones[realId], ...partial };

              // Evitar logs innecesarios por cada actualización local
            }
          });

          // 3. CONVERTIR A ARRAY PARA HANDLEUPDATE
          Object.values(clearedUbicaciones).forEach(u => fullUpdates.push(u));

          // --- DIAGNÓSTICO: VERIFICACIÓN DE CONTRATO ---
          let renderedMaterialsCount = 0;
          fullUpdates.forEach(u => {
            // Contar Materiales Empaquetados (Cajas) (Palés)
            u.cajas?.forEach(c => renderedMaterialsCount += c.contenido.length);

            // Contar Materiales Sueltos (Palés)
            if (u.materiales) renderedMaterialsCount += u.materiales.length;

            // Contar Materiales en Estanterías
            if (u.cajasEstanteria) {
              Object.values(u.cajasEstanteria).forEach(c => renderedMaterialsCount += c.contenido.length);
            }
          });

          console.log(`📊 CONTRACT DIAGNOSTIC:`);
          console.log(`   - Input Rows (Sheet): ${rawData.length}`);
          console.log(`   - Rendered Materials: ${renderedMaterialsCount}`);

          if (rawData.length !== renderedMaterialsCount) {
            console.error(`⚠️ DISCREPANCY DETECTED! Input ${rawData.length} != Rendered ${renderedMaterialsCount}. Check for rejected ghosts or unmapped items.`);
            // En modo estricto, podríamos querer alertar, pero por ahora registrar el error es suficiente.
          } else {
            console.log(`✅ DATA INTEGRITY VERIFIED. 1:1 Match.`);
          }

          if (fullUpdates.length > 0) {
            handleUpdate(fullUpdates);
            console.log("App: Live inventory applied.");

            // Ejecutar Validación en el NUEVO estado (aproximado mediante fusión local)
            // fullUpdates contiene los objetos NUEVOS. Necesitamos fusionarlos con los actuales para validar todos.
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
              // setShowErrorsModal(true); // Opcional: ¿Auto-abrir? No, solo alertar.
            }
          }
        }
      } catch (e) {
        console.warn("App: Failed to load live inventory", e);
      }
    };

    loadLiveInventory();
    // console.warn("App: Live Inventory Loading DISABLED by user request.");
  }, []); // Ejecutar una vez al montar

  const handleUpdate = async (updated: Ubicacion | Ubicacion[]) => {
    // Interceptar para el rol USER (Propuestas)
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
        // Notificar al usuario
        // Idealmente usar un "toast", pero la alerta está bien por ahora / El usuario solicitó la notificación
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

    // Comportamiento por Defecto (Admin / Local)
    const updates = Array.isArray(updated) ? updated : [updated];
    if (updates.length === 0) return;
    const nextUbicaciones = { ...state.ubicaciones };
    updates.forEach(u => { nextUbicaciones[u.id] = u; });
    pushState({ ...state, ubicaciones: nextUbicaciones });
  };

  // Ayudante de Selección de Rango
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
      // Si estamos en modo de selección, ¿hacer clic en un espacio vacío NO debería limpiar la selección? 
      // Usualmente los usuarios esperan que "hacer clic afuera" limpie. Mantengámoslo limpiando por ahora 
      // O hacer que solo el botón explícito de "Limpiar" limpie en el modo móvil.
      // Por ahora, comportamiento estándar: clic en el fondo -> limpiar.
      setSelectedIds(new Set());
      setLastFocusedId(null);
      return;
    }

    // Forzar el comportamiento de alternancia (toggle) si el Modo de Selección está activo (y no es una selección de rango)
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

  // MANEJADOR DE IMPRESIÓN
  const handlePrint = (options: PrintOptions) => {
    setShowPrintModal(false);

    // 1. Filtrar Datos
    let dataToPrint: Ubicacion[] = [];
    const allUbicaciones = Object.values(state.ubicaciones);

    if (options.scope === 'ALL') {
      dataToPrint = allUbicaciones;
    } else if (options.scope === 'SELECTION') {
      dataToPrint = allUbicaciones.filter(u => selectedIds.has(u.id));
    } else if (options.scope === 'PROGRAM' && options.programString) {
      dataToPrint = allUbicaciones.filter(u => u.programa === options.programString);
    }

    // FILTRAR ELEMENTOS ESTRUCTURALES (Muros, Puertas, Furgoneta)
    dataToPrint = dataToPrint.filter(u => u.tipo !== 'muro' && u.tipo !== 'puerta' && u.tipo !== 'zona_carga');

    if (dataToPrint.length === 0) {
      alert("No hay elementos para imprimir con la selección actual.");
      return;
    }

    // 2. Manejar Formato
    if (options.format === 'LIST' || options.format === 'CARDS') {
      setPrintData(dataToPrint);
      // PrintView activará window.print() al montarse una vez renderizado.
    } else {
      // MODO MAPA
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
                  {/* Menú / Configuración (Lado Izquierdo) - Vacío por ahora */}
                </div>
              }
              rightAction={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

                  {/* Controles de la Nube */}
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

                  {/* Grupo de Controles del Mapa */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => setIsEditModeGlobal(!isEditModeGlobal)}
                        className={`icon-btn ${isEditModeGlobal ? 'active' : ''}`}
                        title={isEditModeGlobal ? "Bloquear Movimiento" : "Modo Edición (Mover Objetos)"}
                        style={isEditModeGlobal ? { backgroundColor: '#4CAF50', color: 'white' } : {}}
                      >
                        ✋
                      </button>
                    )}

                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => setEditMapMode(!editMapMode)}
                        className={`icon-btn ${editMapMode ? 'active' : ''}`}
                        title={editMapMode ? "Cerrar Modo Mapeado" : "Editar Muros del Almacén"}
                        style={editMapMode ? { backgroundColor: '#F44336', color: 'white' } : {}}
                      >
                        📐
                      </button>
                    )}

                    <button
                      onClick={() => setIsSelectionMode(!isSelectionMode)}
                      className={`icon-btn ${isSelectionMode ? 'active' : ''}`}
                      title={isSelectionMode ? "Modo Selección Activo" : "Activar Selección Múltiple"}
                    >
                      <IconSelection active={isSelectionMode} size={20} />
                    </button>

                    <button onClick={() => setShowPrintModal(true)} className="icon-btn" title="Imprimir">
                      <IconPrinter size={20} />
                    </button>

                    <button onClick={() => setShowGrid(!showGrid)} className="icon-btn" title="Rejilla">
                      <IconGrid active={showGrid} size={20} />
                    </button>
                  </div>

                  {/* BOTÓN DE ADMINISTRADOR (Movido Aquí) */}
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
                      {/* BOTÓN DE CONFIGURACIÓN (Movido Aquí junto al Escudo) */}
                      {!isMobile && (
                        <button className="icon-btn" onClick={() => setShowConfig(true)} title="Configuración">
                          <IconSettings size={20} />
                        </button>
                      )}
                    </>
                  )}

                  <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                  {/* Menú de Usuario (Avatar) */}
                  <UserMenu user={user} onLogout={logout} onExportDataTS={handleExportDataTS} />
                </div>
              }
            />
          }

          main={
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {viewMode === '2D' ? (
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
                  showGeoPoints={editMapMode} // Pass explicit prop for map editing mode
                  isEditModeGlobal={isEditModeGlobal} // NUEVO PROP DE BLOQUEO DE MOVIMIENTO
                  onVisitorError={() => {
                    setAssistantAlert("Solo puedes admirar el resultado de mi obra, si quieres usarlo tienes que pedir permiso al administrador");
                  }}
                  programColors={programColors}
                  isMobile={isMobile}
                  readOnly={(isMobile && !isSelectionMode) && !isEditModeGlobal}
                  activeFilter={activeFilter}
                />
              ) : (
                <WarehouseMap3D
                  locations={state.ubicaciones}
                  activeFilter={activeFilter}
                  geometry={state.geometry}
                  onHover={() => { }}
                />
              )}
            </div>
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
                {/* 1. Botón para Desplegar Leyenda Estática (Ancho Completo) en MÓVIL para salvar espacio */}
                <div style={{ padding: '4px', background: '#fff', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                  <span style={{ fontSize: '10px', color: '#666', cursor: 'pointer' }} onClick={() => setShowLegendModal(true)}>
                    👉 Toca aquí para ver la Leyenda de Colores Oculta 👈
                  </span>
                </div>

                {/* 2. Barra de Herramientas Inferior */}
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
                    // Forzar guardado inmediato para asegurar que persista incluso si useEffect es lento
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

              {/* Vista de Impresión Oculta (para Impresión de Lista) duplicado eliminado */}

              {/* Vista de Impresión Oculta */}
              {assistantAlert && (
                <AssistantAlert
                  message={assistantAlert}
                  onClose={() => setAssistantAlert(null)}
                />
              )}

              {/* Ventana del Chatbot */}
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

              {/* Panel de Propiedades (Legado) */}
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

              {/* Asistente Flotante (Arrastrable) */}
              <animated.div
                ref={assistantRef}
                {...bindAssistantDrag()}
                style={{
                  position: 'fixed', // Usar FIXED (Fijo) para mantenerse encima del scroll
                  top: -35, // Movido hacia ARRIBA aún más (-35)
                  left: 90, // Movido a la IZQUIERDA para situarse entre el engranaje y el título
                  zIndex: 9999,
                  // Usar transform para rendimiento, pero mapeado desde valores simples de Spring
                  x,
                  y,
                  touchAction: 'none',
                  cursor: 'grab',
                  pointerEvents: 'auto' // CRÍTICO para los hijos de la superposición (overlay)
                }}
              >
                <AssistantCharacter
                  size="lg"
                  state={isChatbotOpen ? 'listening' : 'idle'}
                  // Eliminar onClick aquí, manejado por bindAssistantDrag
                  hasNotification={false}
                />
              </animated.div>

              {/* Leyenda Arrastrable (Pulido de UI) - SOLO ESCRITORIO */}
              {!isMobile && <DraggableLegend programColors={programColors} activeFilter={activeFilter} onFilterClick={setActiveFilter} />}

              {/* TOGGLE 3D/2D CONTROLS */}
              <div
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  zIndex: 1000,
                  display: 'flex',
                  gap: '10px'
                }}
              >
                <button
                  onClick={() => setViewMode(prev => prev === '2D' ? '3D' : '2D')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: viewMode === '3D' ? '#00E676' : '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  🚀 Alternar {viewMode === '2D' ? '3D' : '2D'}
                </button>
              </div>

              {/* TOOLTIP EMERGENTE 2D/3D COMBINADO */}
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
        {/* Modal Desplegable de Leyenda Móvil */}
        {showLegendModal && isMobile && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 15
          }} onClick={() => setShowLegendModal(false)}>
            <div style={{
              background: 'white', borderRadius: 12, padding: '25px 20px 20px 20px', width: '100%', maxWidth: 360,
              display: 'flex', flexDirection: 'column', gap: 20, position: 'relative',
              maxHeight: '90vh', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }} onClick={e => e.stopPropagation()}>

              <h3 style={{ margin: 0, borderBottom: '1px solid #eee', paddingBottom: 15, fontSize: 22, color: '#333' }}>
                Leyenda de Colores
              </h3>

              <button
                onClick={() => setShowLegendModal(false)}
                style={{ position: 'absolute', top: 15, right: 15, background: 'transparent', border: 'none', fontSize: 28, cursor: 'pointer', color: '#999', padding: 5, lineHeight: 1 }}
              >✖</button>

              <div style={{
                display: 'flex', flexDirection: 'column', gap: '16px',
                overflowY: 'auto', paddingBottom: 10, paddingRight: 5
              }}>
                {Object.entries(programColors).map(([prog, col]) => (
                  <div
                    key={prog}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: activeFilter === prog ? '#f0f8ff' : 'transparent',
                      border: activeFilter === prog ? '1px solid #4CAF50' : '1px solid transparent',
                      opacity: activeFilter && activeFilter !== prog ? 0.4 : 1
                    }}
                    onClick={() => setActiveFilter(prev => prev === prog ? null : prog)}
                  >
                    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: col, border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    <span style={{ fontSize: 18, fontWeight: 500, color: '#444', lineHeight: 1.3 }}>{prog}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}
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
