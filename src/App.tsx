import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginModal } from './components/Login/LoginModal';
import { AssistantService } from './services/AssistantService';
import { useToast } from './context/ToastContext';

// Componentes
import { AppShell } from './components/Layout/AppShell';
import { Header } from './components/Layout/Header';
import { AssistantChat } from './components/Assistant/AssistantChat';
import { AssistantAlert } from './components/Assistant/AssistantAlert';
import WarehouseMap from './WarehouseMap';
import { WarehouseMap3D } from './components/Map3D/WarehouseMap3D';
import PropertiesPanel from './PropertiesPanel';
import { ConfigModal } from './ConfigModal';
import { QuickSearch } from './components/UI/QuickSearch';
import { PrintModal } from './components/UI/PrintModal';
import { InventoryErrorsModal } from './components/Admin/InventoryErrorsModal';
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
  IconMove,
  IconWallEdit,
  IconCloudDown,
  IconSave,
  IconUndo,
  IconRedo
} from './components/UI/Icons';

// Estilos
import './App.css';

import './styles/print.css';
import { useIsMobile } from './hooks/useIsMobile';

// --- HOOK DE HISTORIAL ---
import { useWarehouseState } from './hooks/useWarehouseState';

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

  const { user, logout } = useAuth();
  const {
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
  } = useWarehouseState();
  const { showToast } = useToast();
  const [pendingAssistantAction, setPendingAssistantAction] = useState<{ type: string, payload: any } | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Modo Vista 3D
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');

  // Posición del Asistente (Arrastrable)
  
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


  const isMobile = useIsMobile();

  // Efectos

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
          <AdminDashboard
            mapGeometry={state.geometry}
            mapUbicaciones={state.ubicaciones}
          />
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
              title="SGA Eventos v1.5.15"
              subtitle="Gestión de Almacén"
              userRole={user?.role as any}
              isSyncing={isSyncing}
              leftAction={
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Menú / Configuración (Lado Izquierdo) - Vacío por ahora */}
                </div>
              }
              rightAction={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

                  {/* Controles de la Nube y Deshacer */}
                  {user?.role !== 'VISITOR' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {user?.role === 'ADMIN' && (
                      <>
                        <button onClick={() => handleLoadFromCloud(false)} disabled={isSyncing} className="icon-btn" title="Cargar">
                          <IconCloudDown size={20} />
                        </button>
                        <button onClick={handleSaveToCloud} disabled={isSyncing} className="icon-btn" title="Guardar">
                          <IconSave size={20} />
                        </button>
                      </>
                    )}
                    <button onClick={undo} disabled={!canUndo} className="icon-btn" title="Deshacer">
                      <IconUndo size={20} />
                    </button>
                    <button onClick={redo} disabled={!canRedo} className="icon-btn" title="Rehacer">
                      <IconRedo size={20} />
                    </button>
                  </div>
                  )}

                  <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                  <QuickSearch
                    ubicaciones={state.ubicaciones}
                    onSelectLocation={(id) => handleSelectLocation(id)}
                  />

                  <div style={{ width: 1, height: 24, background: '#ffffff30', margin: '0 4px' }} />

                  {/* Grupo de Controles del Mapa (Exclusivo Admin y User, no Visitor) */}
                  {user?.role !== 'VISITOR' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setIsEditModeGlobal(!isEditModeGlobal)}
                      className={`icon-btn ${isEditModeGlobal ? 'active' : ''}`}
                      title={isEditModeGlobal ? "Bloquear Movimiento" : "Modo Mover Palets"}
                      style={isEditModeGlobal ? { backgroundColor: '#4CAF50', color: 'white' } : {}}
                    >
                      <IconMove active={isEditModeGlobal} size={20} />
                    </button>

                    {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => setEditMapMode(!editMapMode)}
                      className={`icon-btn ${editMapMode ? 'active' : ''}`}
                      title={editMapMode ? "Cerrar Modo Mapeado" : "Editar Muros del Almacén"}
                      style={editMapMode ? { backgroundColor: '#F44336', color: 'white' } : {}}
                    >
                      <IconWallEdit active={editMapMode} size={20} color={editMapMode ? 'white' : 'currentColor'} />
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
                  )}

                  {/* Si es Visitor, al menos ve Print y Grid */}
                  {user?.role === 'VISITOR' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setShowGrid(!showGrid)} className="icon-btn" title="Rejilla">
                      <IconGrid active={showGrid} size={20} />
                    </button>
                  </div>
                  )}

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
                  <UserMenu user={user} onLogout={logout} onExportDataTS={user?.role === 'ADMIN' ? handleExportDataTS : undefined} />
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
                  onProposeMove={async (updates) => {
                      if (updates.length > 0) {
                          const leader = updates[0];
                          const original = state.ubicaciones[leader.id];

                          // Versión ligera de ubicaciones (solo datos geométricos para mini-mapa)
                          const slimLocations: Record<string, any> = {};
                          Object.values(state.ubicaciones).forEach(u => {
                              slimLocations[u.id] = { id: u.id, tipo: u.tipo, x: u.x, y: u.y, width: u.width, depth: u.depth, rotation: u.rotation };
                          });

                          const proposalPayload = {
                              locationId: leader.id,
                              originalX: original?.x ?? leader.x,
                              originalY: original?.y ?? leader.y,
                              originalRot: original?.rotation ?? 0,
                              newX: leader.x,
                              newY: leader.y,
                              newRot: leader.rotation,
                              geometry: state.geometry,
                              allLocations: slimLocations
                          };

                          // Persistir en BD
                          try {
                              const authToken = localStorage.getItem('auth_token') || '';
                              await AssistantService.submitAction('PROPOSE_MOVE', proposalPayload, authToken);
                              showToast('Propuesta enviada. Queda a la espera de aprobación del administrador.', 'success');
                          } catch (err) {
                              console.error('Error al enviar propuesta:', err);
                              showToast('No se pudo enviar la propuesta al servidor. Inténtalo de nuevo.', 'error');
                          }

                          // Guardar en estado local por si se quiere mostrar en el chat
                          setPendingAssistantAction({
                              type: 'PROPOSE_MOVE',
                              payload: proposalPayload
                          });
                      }
                  }}
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
              {/* Leyenda Arrastrable (Pulido de UI) - SOLO ESCRITORIO */}
              {!isMobile && <DraggableLegend programColors={programColors} activeFilter={activeFilter} onFilterClick={setActiveFilter} />}

              {/* Modal de Configuración */}
              {showConfig && (
                <ConfigModal
                  initialColors={programColors}
                  scriptUrl={scriptUrl}
                  onSave={(newColors, newUrl) => {
                    console.log("💾 Almacenando Configuración:", newColors);
                    setProgramColors(newColors);
                    localStorage.setItem('program_colors_config', JSON.stringify(newColors));

                    setScriptUrl(newUrl);
                    localStorage.setItem('google_script_url', newUrl);

                    setShowConfig(false);
                    showToast('Configuración guardada correctamente.', 'success');
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
                initialAction={pendingAssistantAction}
                onClearAction={() => setPendingAssistantAction(null)}
              />

              {/* Panel de Propiedades (Legado) */}
              {selectedLocation && !isSelectionMode && !isEditModeGlobal && selectedLocation.id !== 'van_v3' && (
                <div style={{ position: 'absolute', bottom: 80, left: 20, right: 20, zIndex: 100 }}>
                  <PropertiesPanel
                    location={selectedLocation}
                    onUpdate={handleUpdate}
                    onClose={() => setSelectedIds(new Set())}
                    programColors={programColors}
                    onAssistantAction={(action) => {
                      setPendingAssistantAction(action);
                    }}
                    onPrint={handlePrintSingle}
                  />
                </div>
              )}

              {/* TOGGLE 3D/2D CONTROLS */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px', // Adjusted to perfectly align vertically with Leaflet map controls
                  right: '140px', // Shifted further left to avoid overlapping the 2D map zoom controls
                  zIndex: 10,
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
                  {viewMode === '2D' ? 'Modo 3D' : 'Modo 2D'}
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
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a4a1f 0%, #2E7D32 50%, #1B5E20 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
        gap: '24px'
      }}>
        {/* Animated warehouse SVG */}
        <svg width="64" height="64" viewBox="0 0 32 32" fill="none" style={{ filter: 'drop-shadow(0 0 18px rgba(129,199,132,0.6))' }}>
          <path d="M2 14L16 4L30 14V30H20V20H12V30H2V14Z" fill="url(#loadGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinejoin="round"/>
          <rect x="13" y="21" width="6" height="9" rx="1" fill="rgba(255,255,255,0.15)"/>
          <defs>
            <linearGradient id="loadGrad" x1="2" y1="4" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6ee7b7"/>
              <stop offset="100%" stopColor="#10b981"/>
            </linearGradient>
          </defs>
        </svg>
        {/* Spinner */}
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(165,214,167,0.9)" strokeWidth="2.5"
          style={{ animation: 'spin 0.85s linear infinite' }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#69F0AE"/>
        </svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#f1f8e9', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.3px' }}>SGA Eventos</div>
          <div style={{ color: 'rgba(200,230,201,0.7)', fontSize: '0.75rem', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Cargando sistema...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  return <AuthenticatedApp />;
}

export default App;
