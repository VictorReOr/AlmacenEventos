import React from 'react';
import styles from './Header.module.css';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    leftAction?: React.ReactNode; // Botón menú o volver
    rightAction?: React.ReactNode; // Configuración o Usuario
}

export const Header: React.FC<HeaderProps> = ({
    title = "Gestión Almacén",
    subtitle,
    leftAction,
    rightAction
}) => {
    return (
        <div className={styles.header}>
            <div className={styles.left}>
                {leftAction}
            </div>

            <div className={styles.center}>
                <h1 className={styles.title}>{title}</h1>
                {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
            </div>

            <div className={styles.right}>
                {rightAction}
            </div>
        </div>
    );
};
