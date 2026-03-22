import React from 'react';
import styles from './Header.module.css';

type UserRole = 'ADMIN' | 'USER' | 'VISITOR';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    leftAction?: React.ReactNode;
    rightAction?: React.ReactNode;
    userRole?: UserRole;
    isSyncing?: boolean;
}

const ROLE_CFG: Record<UserRole, { label: string; class: string }> = {
    ADMIN:   { label: 'Admin',   class: styles.roleAdmin },
    USER:    { label: 'Usuario', class: styles.roleUser },
    VISITOR: { label: 'Visitor', class: styles.roleVisitor },
};

export const Header: React.FC<HeaderProps> = ({
    title = "Gestión Almacén",
    subtitle,
    leftAction,
    rightAction,
    userRole,
    isSyncing = false,
}) => {
    const roleCfg = userRole ? ROLE_CFG[userRole] : null;

    return (
        <div className={styles.header}>
            {/* Animated background layers */}
            <div className={styles.bgGlow} aria-hidden="true" />
            <div className={styles.bgGrid} aria-hidden="true" />

            <div className={styles.left}>
                {leftAction}
            </div>

            <div className={styles.center}>
                <div className={styles.brandMark}>
                    {/* Warehouse SVG icon */}
                    <svg
                        className={styles.warehouseIcon}
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <path
                            d="M2 14L16 4L30 14V30H20V20H12V30H2V14Z"
                            fill="url(#iconGrad)"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="1"
                            strokeLinejoin="round"
                        />
                        <rect x="13" y="21" width="6" height="9" rx="1" fill="rgba(255,255,255,0.15)" />
                        <rect x="8" y="17" width="5" height="4" rx="0.5" fill="rgba(255,255,255,0.2)" />
                        <rect x="19" y="17" width="5" height="4" rx="0.5" fill="rgba(255,255,255,0.2)" />
                        <defs>
                            <linearGradient id="iconGrad" x1="2" y1="4" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#6ee7b7" />
                                <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className={styles.titleGroup}>
                        <h1 className={styles.title}>{title}
                            <span className={styles.versionBadge}>v1.1</span>
                            {/* Role badge */}
                            {roleCfg && (
                                <span className={`${styles.roleBadge} ${roleCfg.class}`}>
                                    {roleCfg.label}
                                </span>
                            )}
                        </h1>
                        <div className={styles.subtitle}>
                            {isSyncing ? (
                                <span className={styles.syncingRow}>
                                    {/* Mini spinner */}
                                    <svg className={styles.syncSpinner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                                        <path d="M12 2a10 10 0 0 1 10 10"/>
                                    </svg>
                                    Sincronizando...
                                </span>
                            ) : (
                                subtitle ?? 'Sistema de control de inventario'
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.right}>
                {rightAction}
            </div>
        </div>
    );
};
