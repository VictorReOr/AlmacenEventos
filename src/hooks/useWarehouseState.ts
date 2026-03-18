import { useState, useEffect, useRef } from 'react';
import { useHistory } from './useHistory';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { AssistantService } from '../services/AssistantService';
import { InventoryService } from '../services/InventoryService';
import { validateInventory } from '../utils/inventoryValidation';
import { sanitizeState } from '../utils/cleanup';
import { generateInitialState } from '../data';
import { PROGRAM_COLORS } from '../types';
import type { Ubicacion } from '../types';
import type { PrintOptions } from '../components/UI/PrintModal';
import type { InventoryError } from '../utils/inventoryValidation';
import type { WarehouseMapRef } from '../WarehouseMap';

export function useWarehouseState(user: any) {
  const mapRef = useRef<WarehouseMapRef>(null);
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem('warehouse_V74.0_LAYOUT_UPDATE');

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
  const [lastFocusedId, setLastFocusedId] = useState<string | null>(null);
  const [assistantAlert, setAssistantAlert] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Modo Vista 3D

  // Posición del Asistente (Arrastrable)
  // Posición Persistente

  // Inicializar spring desde el almacenamiento


  // DEBUG: Mostrar Alerta con URL de API al montar para verificar ruta de conexión
  useEffect(() => {
    // console.log("🔌 Conectando a:", config.API_BASE_URL);
  }, []);
  // Detección de Diseño (Layout)

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

  // Efectos
  useEffect(() => { localStorage.setItem('google_script_url', scriptUrl); }, [scriptUrl]);
  useEffect(() => { localStorage.setItem('warehouse_V74.0_LAYOUT_UPDATE', JSON.stringify(state)); }, [state]);
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
  const selectedLocation = (selectedIds.size === 1) ? state.ubicaciones[Array.from(selectedIds)[0]] : null;

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

  const selectedLocation = (selectedIds.size === 1) ? state.ubicaciones[Array.from(selectedIds)[0]] : null;

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

  return {
    state, pushState, undo, redo, canUndo, canRedo,
    selectedIds, setSelectedIds, handleSelectLocation, handleDeleteSelection, handleCreatePallet,
    isSelectionMode, setIsSelectionMode, selectedLocation,
    editMapMode, setEditMapMode, showGrid, setShowGrid, activeFilter, setActiveFilter, 
    programColors, setProgramColors, isEditModeGlobal, setIsEditModeGlobal,
    scriptUrl, setScriptUrl, isSyncing, handleSaveToCloud, handleLoadFromCloud, handleExportDataTS, handleUpdate,
    inventoryErrors, showErrorsModal, setShowErrorsModal, assistantAlert, setAssistantAlert, 
    showLegendModal, setShowLegendModal, showConfig, setShowConfig,
    showPrintModal, setShowPrintModal, printData, setPrintData, handlePrint, handlePrintSingle,
    mapRef
  };
}
