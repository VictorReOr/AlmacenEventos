import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../config';
import { ProposalMiniMap } from './ProposalMiniMap';
import type { Ubicacion } from '../../types';

// Define structures matching Backend
interface PendingAction {
    ID: string;
    TIMESTAMP: string;
    REQUESTER_EMAIL: string;
    ACTION_TYPE: string;
    PAYLOAD_JSON: string;
    STATUS: string;
}

interface UserData {
    email: string;
    role: string;
    name?: string;
}

interface AdminDashboardProps {
    mapGeometry?: { x: number; y: number }[];
    mapUbicaciones?: Record<string, Ubicacion>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ mapGeometry = [], mapUbicaciones = {} }) => {
    const { user, token } = useAuth();
    const [activeTab, setActiveTab] = useState<'PENDING' | 'USERS'>('PENDING');

    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const API_URL = `${config.API_BASE_URL}/api/v1/admin`;

    useEffect(() => {
        if (activeTab === 'PENDING') fetchPending();
        if (activeTab === 'USERS') fetchUsers();
    }, [activeTab]);

    const fetchPending = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error fetching pending actions');
            const data = await res.json();
            setPendingActions(data);
        } catch (e: any) {
            setError(`${e.message} (URL: ${API_URL}/pending)`);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error fetching users');
            const data = await res.json();
            setUsers(data);
        } catch (e: any) {
            setError(`${e.message} (URL: ${API_URL}/users)`);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/pending/${id}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`Failed to ${action}`);

            setSuccessMsg(`Solicitud ${id} ${action === 'approve' ? 'aprobada' : 'rechazada'} correctamente`);
            fetchPending();
        } catch (e: any) {
            setError(`${e.message} (URL: ${API_URL}/pending/${id}/${action})`);
        } finally {
            setLoading(false);
            setTimeout(() => setSuccessMsg(''), 3000);
        }
    };

    const handleRoleUpdate = async (email: string, newRole: string) => {
        if (!confirm(`¿Cambiar ${email} a ${newRole}?`)) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/users/${email}/role?new_role=${newRole}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to update role');
            setSuccessMsg(`Usuario ${email} actualizado a ${newRole}`);
            fetchUsers();
        } catch (e: any) {
            setError(`${e.message}`);
        } finally {
            setLoading(false);
            setTimeout(() => setSuccessMsg(''), 3000);
        }
    };

    const handleCreateBackup = async () => {
        if (!confirm("¿Generar una copia de seguridad inmutable de toda la base de datos (Google Sheets) ahora mismo?")) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/backup`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al crear el Backup en el servidor');
            setSuccessMsg(`🚀 ¡Backup generado exitosamente en Google Drive!`);
        } catch (e: any) {
            setError(`Fallo crítico al crear Backup: ${e.message}`);
        } finally {
            setLoading(false);
            setTimeout(() => setSuccessMsg(''), 5000);
        }
    };

    /** Parsea el PAYLOAD_JSON de una solicitud para extraer datos de movimiento */
    const parseProposalPayload = (json: string): {
        locationId?: string;
        originalX?: number; originalY?: number; originalRot?: number;
        newX?: number; newY?: number; newRot?: number;
        geometry?: { x: number; y: number }[];
        allLocations?: Record<string, Ubicacion>;
        raw: string;
    } => {
        try {
            const parsed = JSON.parse(json);
            return {
                locationId: parsed.locationId,
                originalX: parsed.originalX,
                originalY: parsed.originalY,
                originalRot: parsed.originalRot,
                newX: parsed.newX,
                newY: parsed.newY,
                newRot: parsed.newRot,
                geometry: parsed.geometry,
                allLocations: parsed.allLocations,
                raw: json
            };
        } catch {
            return { raw: json };
        }
    };

    const renderProposalCard = (action: PendingAction) => {
        const payload = parseProposalPayload(action.PAYLOAD_JSON);
        const isMovePropsal = action.ACTION_TYPE === 'PROPOSE_MOVE' || payload.locationId;

        // Usar datos del payload si existen, o fallback a los del mapa actual
        const geo = payload.geometry || mapGeometry;
        const locs = payload.allLocations || mapUbicaciones;

        const hasMiniMap = isMovePropsal && payload.locationId && payload.newX !== undefined && geo.length > 2;

        const typeLabel = isMovePropsal ? '📦 Mover Palé' : action.ACTION_TYPE;
        const timeStr = new Date(action.TIMESTAMP).toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        return (
            <div key={action.ID} style={{
                border: '1px solid #e8edf0',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                overflow: 'hidden',
                backgroundColor: 'white'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{typeLabel}</span>
                        {payload.locationId && (
                            <span style={{
                                marginLeft: 8, background: 'rgba(0,230,118,0.2)',
                                color: '#00e676', padding: '2px 8px', borderRadius: 20,
                                fontSize: 12, fontFamily: 'monospace'
                            }}>
                                {payload.locationId}
                            </span>
                        )}
                    </div>
                    <span style={{ color: '#aaa', fontSize: 12 }}>{timeStr}</span>
                </div>

                {/* Body */}
                <div style={{ padding: '16px', display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                    {/* Mini-mapa */}
                    {hasMiniMap && (
                        <ProposalMiniMap
                            geometry={geo}
                            allLocations={locs as any}
                            palletId={payload.locationId!}
                            originalX={payload.originalX ?? payload.newX!}
                            originalY={payload.originalY ?? payload.newY!}
                            newX={payload.newX!}
                            newY={payload.newY!}
                            newRot={payload.newRot}
                            size={200}
                        />
                    )}

                    {/* Info de texto */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Solicitado por</div>
                            <div style={{ fontWeight: 600, color: '#333' }}>{action.REQUESTER_EMAIL}</div>
                        </div>

                        {isMovePropsal && payload.locationId && (
                            <div style={{ background: '#f5f7fa', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                                <div style={{ marginBottom: 4 }}>
                                    <span style={{ color: '#888' }}>Palé: </span>
                                    <strong style={{ fontFamily: 'monospace' }}>{payload.locationId}</strong>
                                </div>
                                {payload.originalX !== undefined && (
                                    <div style={{ marginBottom: 2 }}>
                                        <span style={{ color: '#888' }}>Pos. actual: </span>
                                        <span style={{ color: '#555' }}>
                                            ({payload.originalX.toFixed(2)}m, {payload.originalY!.toFixed(2)}m)
                                        </span>
                                    </div>
                                )}
                                {payload.newX !== undefined && (
                                    <div>
                                        <span style={{ color: '#888' }}>Pos. propuesta: </span>
                                        <span style={{ color: '#00b884', fontWeight: 600 }}>
                                            ({payload.newX.toFixed(2)}m, {payload.newY!.toFixed(2)}m)
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {!isMovePropsal && (
                            <div style={{ background: '#f5f7fa', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#555', wordBreak: 'break-all' }}>
                                {payload.raw}
                            </div>
                        )}

                        {/* Botones */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                            <button
                                onClick={() => handleAction(action.ID, 'reject')}
                                style={{
                                    flex: 1, padding: '9px 0',
                                    backgroundColor: '#fff0f0', color: '#e53935',
                                    border: '1px solid #e53935', borderRadius: 8,
                                    cursor: 'pointer', fontWeight: 600, fontSize: 13
                                }}
                            >
                                ✗ Rechazar
                            </button>
                            <button
                                onClick={() => handleAction(action.ID, 'approve')}
                                style={{
                                    flex: 1, padding: '9px 0',
                                    backgroundColor: '#e8faf2', color: '#00897b',
                                    border: '1px solid #00897b', borderRadius: 8,
                                    cursor: 'pointer', fontWeight: 600, fontSize: 13
                                }}
                            >
                                ✓ Aprobar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (user?.role !== 'ADMIN') return <div>Acceso Denegado</div>;

    return (
        <div style={{ padding: '20px', backgroundColor: '#f8f9fb', height: '100%', overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, color: '#1a1a2e', fontSize: 20 }}>Panel de Administración 🛡️</h2>
                <button
                    onClick={handleCreateBackup}
                    style={{
                        padding: '9px 18px', backgroundColor: '#3f51b5', color: 'white',
                        border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)', fontSize: 13
                    }}
                    title="Clonar toda la Base de Datos en Google Drive"
                >
                    💾 Forzar Backup
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'white', padding: 4, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {(['PENDING', 'USERS'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: '10px',
                            border: 'none',
                            borderRadius: 8,
                            background: activeTab === tab ? '#1a1a2e' : 'transparent',
                            color: activeTab === tab ? 'white' : '#555',
                            fontWeight: activeTab === tab ? 700 : 400,
                            cursor: 'pointer', fontSize: 13, transition: 'all 0.2s'
                        }}
                    >
                        {tab === 'PENDING' ? '📋 Solicitudes Pendientes' : '👥 Gestión de Usuarios'}
                    </button>
                ))}
            </div>

            {error && <div style={{ color: '#e53935', background: '#fff0f0', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
            {successMsg && <div style={{ color: '#00897b', background: '#e8faf2', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{successMsg}</div>}
            {loading && <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>⏳ Cargando...</div>}

            {/* ---- PENDING TAB ---- */}
            {activeTab === 'PENDING' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ color: '#666', fontSize: 14 }}>
                            {pendingActions.length} solicitu{pendingActions.length !== 1 ? 'des' : 'd'} pendiente{pendingActions.length !== 1 ? 's' : ''}
                        </span>
                        <button onClick={fetchPending} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                            🔄 Actualizar
                        </button>
                    </div>
                    {pendingActions.length === 0 && !loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#aaa' }}>
                            <div style={{ fontSize: 40 }}>✅</div>
                            <div style={{ marginTop: 8 }}>No hay solicitudes pendientes</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 16 }}>
                            {pendingActions.map(renderProposalCard)}
                        </div>
                    )}
                </div>
            )}

            {/* ---- USERS TAB ---- */}
            {activeTab === 'USERS' && (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f0f0f0', background: '#f8f9fb' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#555' }}>Email</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#555' }}>Nombre</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#555' }}>Rol</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#555' }}>Cambiar Rol</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.email} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '12px 16px', fontSize: 14 }}>{u.email}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 14 }}>{u.name}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                            backgroundColor: u.role === 'ADMIN' ? '#E3F2FD' : u.role === 'VISITOR' ? '#FFF3E0' : '#E8F5E9',
                                            color: u.role === 'ADMIN' ? '#1565C0' : u.role === 'VISITOR' ? '#E65100' : '#2E7D32'
                                        }}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleUpdate(u.email, e.target.value)}
                                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
                                        >
                                            <option value="VISITOR">VISITOR</option>
                                            <option value="USER">USER</option>
                                            <option value="ADMIN">ADMIN</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
