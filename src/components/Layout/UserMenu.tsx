import React, { useState } from 'react';

interface User {
    email: string;
    role: 'ADMIN' | 'USER' | 'VISITOR';
    name?: string;
}

interface UserMenuProps {
    user: User | null;
    onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!user) return null;

    // Get initials or first letter
    const displayName = user.name || user.email.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();

    // Role text (Capitalized)
    const roleText = user.role.charAt(0) + user.role.slice(1).toLowerCase();

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s'
                }}
            >
                {/* Avatar Circle */}
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    border: '2px solid rgba(255,255,255,0.2)'
                }}>
                    {initial}
                </div>

                {/* Text Info (Desktop only?) */}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>{displayName}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>{roleText}</span>
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '8px',
                    minWidth: '150px',
                    zIndex: 1000,
                    color: '#333'
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #eee', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{user.email}</div>
                    </div>

                    <button
                        onClick={onLogout}
                        style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px',
                            background: 'none',
                            border: 'none',
                            color: '#D32F2F',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FFEBEE'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        🚪 Cerrar Sesión
                    </button>
                </div>
            )}
        </div>
    );
};
