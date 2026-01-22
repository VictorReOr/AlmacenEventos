import React from 'react';
import styles from './AssistantCharacter.module.css';
import almacenitoIcon from '../../assets/almacenito.png';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'success' | 'error' | 'speaking';

interface AssistantCharacterProps {
    state?: AssistantState;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
    className?: string;
    hasNotification?: boolean;
}

export const AssistantCharacter: React.FC<AssistantCharacterProps> = ({
    state = 'idle',
    size = 'md',
    onClick,
    className,
    hasNotification = false
}) => {
    return (
        <div
            className={`
        ${styles.container} 
        ${styles[size]} 
        ${onClick ? styles.clickable : ''} 
        ${className || ''}
      `}
            onClick={onClick}
        >
            <div className={`${styles.avatarWrapper} ${styles[state]}`}>
                <img src={almacenitoIcon} alt="Almacenito Asistente" className={styles.image} />

                {/* Anillos de estado (animaciones) */}
                {state === 'listening' && <div className={styles.pulseRing} />}
                {state === 'thinking' && <div className={styles.spinRing} />}
                {state === 'success' && <div className={styles.successGlow} />}
                {state === 'error' && <div className={styles.errorShake} />}

                {/* Badge de notificación */}
                {hasNotification && <div className={styles.badge} />}
            </div>
        </div>
    );
};
