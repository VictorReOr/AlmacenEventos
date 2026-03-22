import React from 'react';
import styles from './Header.module.css';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    leftAction?: React.ReactNode;
    rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
    title = "Gestión Almacén",
    subtitle,
    leftAction,
    rightAction
}) => {
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
                        </h1>
                        {subtitle
                            ? <div className={styles.subtitle}>{subtitle}</div>
                            : <div className={styles.subtitle}>Sistema de control de inventario</div>
                        }
                    </div>
                </div>
            </div>

            <div className={styles.right}>
                {rightAction}
            </div>
        </div>
    );
};
