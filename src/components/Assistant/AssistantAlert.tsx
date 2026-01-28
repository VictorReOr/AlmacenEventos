import React from 'react';
import styles from './AssistantAlert.module.css';

interface AssistantAlertProps {
    message: string;
    onClose: () => void;
}

export const AssistantAlert: React.FC<AssistantAlertProps> = ({ message, onClose }) => {
    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <span className={styles.avatar}>🧠</span>
                    <span className={styles.title}>Almacenito dice:</span>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <div className={styles.body}>
                    <p>{message}</p>
                </div>
                <div className={styles.footer}>
                    <button className={styles.okBtn} onClick={onClose}>Entendido</button>
                </div>
            </div>
        </div>
    );
};
