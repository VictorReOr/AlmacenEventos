import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../config';

// Define structures matching Backend
interface PendingAction {
    ID: string;
    TIMESTAMP: string;
    REQUESTER_EMAIL: string;
    ACTION_TYPE: string;
    PAYLOAD_JSON: string; // We can parse this to show details
    STATUS: string;
}

interface UserData {
    email: string; // Mapped from USER_ID
    role: string;
    name?: string;
}

export const AdminDashboard: React.FC = () => {
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

            setSuccessMsg(`Action ${id} ${action}d successfully`);
            fetchPending(); // Refresh
        } catch (e: any) {
            setError(`${e.message} (URL: ${API_URL}/pending/${id}/${action})`);
        } finally {
            setLoading(false);
            setTimeout(() => setSuccessMsg(''), 3000);
        }
    };

    const handleRoleUpdate = async (email: string, newRole: string) => {
        if (!confirm(`Are you sure you want to change ${email} to ${newRole}?`)) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/users/${email}/role?new_role=${newRole}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to update role');

            setSuccessMsg(`User ${email} updated to ${newRole}`);
            fetchUsers(); // Refresh
        } catch (e: any) {
            setError(`${e.message} (URL: ${API_URL}/users/${email}/role)`);
        } finally {
            setLoading(false);
            setTimeout(() => setSuccessMsg(''), 3000);
        }
    };

    const parsePayload = (json: string) => {
        try {
            const moves = JSON.parse(json);
            return moves.map((m: any) => `${m.type}: ${m.qty} ${m.item} (${m.origin} -> ${m.destination})`).join(', ');
        } catch {
            return json;
        }
    };

    if (user?.role !== 'ADMIN') return <div>Access Denied</div>;

    return (
        <div style={{ padding: '20px', backgroundColor: 'white', height: '100%', overflowY: 'auto' }}>
            <h2>Panel de Administración 🛡️</h2>

            <div style={{ marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
                <button
                    onClick={() => setActiveTab('PENDING')}
                    style={{
                        padding: '10px 20px',
                        marginRight: '10px',
                        border: 'none',
                        borderBottom: activeTab === 'PENDING' ? '3px solid #009688' : 'none',
                        background: 'transparent',
                        fontWeight: activeTab === 'PENDING' ? 'bold' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    Solicitudes Pendientes
                </button>
                <button
                    onClick={() => setActiveTab('USERS')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderBottom: activeTab === 'USERS' ? '3px solid #009688' : 'none',
                        background: 'transparent',
                        fontWeight: activeTab === 'USERS' ? 'bold' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    Gestión de Usuarios
                </button>
            </div>

            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
            {successMsg && <div style={{ color: 'green', marginBottom: '10px' }}>{successMsg}</div>}
            {loading && <div>Cargando...</div>}

            {activeTab === 'PENDING' && (
                <div>
                    {pendingActions.length === 0 ? <p>No hay acciones pendientes.</p> : (
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {pendingActions.map(action => (
                                <div key={action.ID} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <strong>{action.REQUESTER_EMAIL}</strong>
                                        <span style={{ color: '#888', fontSize: '0.9em' }}>{new Date(action.TIMESTAMP).toLocaleString()}</span>
                                    </div>
                                    <div style={{ marginBottom: '15px', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '4px' }}>
                                        {parsePayload(action.PAYLOAD_JSON)}
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleAction(action.ID, 'reject')}
                                            style={{ padding: '8px 15px', backgroundColor: '#e57373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Rechazar
                                        </button>
                                        <button
                                            onClick={() => handleAction(action.ID, 'approve')}
                                            style={{ padding: '8px 15px', backgroundColor: '#81c784', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Aprobar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'USERS' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                            <th style={{ padding: '10px' }}>Email</th>
                            <th style={{ padding: '10px' }}>Nombre</th>
                            <th style={{ padding: '10px' }}>Rol Actual</th>
                            <th style={{ padding: '10px' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.email} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px' }}>{u.email}</td>
                                <td style={{ padding: '10px' }}>{u.name}</td>
                                <td style={{ padding: '10px' }}>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.8em',
                                        backgroundColor: u.role === 'ADMIN' ? '#E3F2FD' : u.role === 'VISITOR' ? '#FFF3E0' : '#E8F5E9',
                                        color: u.role === 'ADMIN' ? '#1565C0' : u.role === 'VISITOR' ? '#E65100' : '#2E7D32'
                                    }}>
                                        {u.role}
                                    </span>
                                </td>
                                <td style={{ padding: '10px' }}>
                                    <select
                                        value={u.role}
                                        onChange={(e) => handleRoleUpdate(u.email, e.target.value)}
                                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
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
            )}
        </div>
    );
};
