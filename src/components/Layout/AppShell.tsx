import React from 'react';
import styles from './AppShell.module.css';

interface AppShellProps {
    header: React.ReactNode;
    main: React.ReactNode;
    overlay?: React.ReactNode;
    footer?: React.ReactNode; // Barra del asistente
    className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
    header,
    main,
    overlay,
    footer,
    className
}) => {
    return (
        <div className={`${styles.shell} ${className || ''}`}>
            <header className={styles.headerArea}>
                {header}
            </header>

            <main className={styles.mainArea}>
                {main}
            </main>

            {overlay && (
                <div className={styles.overlayArea}>
                    {overlay}
                </div>
            )}

            {footer && (
                <footer className={styles.footerArea}>
                    {footer}
                </footer>
            )}
        </div>
    );
};
