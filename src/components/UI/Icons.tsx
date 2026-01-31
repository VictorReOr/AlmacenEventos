import React from 'react';

type IconProps = {
    size?: number;
    color?: string;
    className?: string;
    strokeWidth?: number;
};

// Default props
const D = { s: 20, c: "currentColor", w: 2 };

export const IconSettings: React.FC<IconProps> = ({ size = D.s, color = D.c, strokeWidth = D.w, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

export const IconShield: React.FC<IconProps> = ({ size = D.s, color = D.c, strokeWidth = D.w, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

export const IconCheckbox: React.FC<IconProps & { checked?: boolean }> = ({ size = D.s, color = D.c, strokeWidth = D.w, className, checked }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {checked ? (
            <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </g>
        ) : (
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth} />
        )}
    </svg>
);

export const IconPrinter: React.FC<IconProps> = ({ size = D.s, color = D.c, strokeWidth = D.w, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
    </svg>
);

export const IconGrid: React.FC<IconProps & { active?: boolean }> = ({ size = D.s, color = D.c, strokeWidth = D.w, className, active }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        {active ? (
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
        ) : (
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        )}
    </svg>
);

export const IconCloudUp: React.FC<IconProps> = ({ size = D.s, color = D.c, strokeWidth = D.w, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 19V9m-4 4 4-4 4 4" />
        <path d="M4 22h16" />
        <path d="M20 16a5 5 0 0 0-4-1.5" />
        <path d="M4 16a5 5 0 0 1 5.5-3.5" />
    </svg>
);

export const IconCloudDown: React.FC<IconProps> = ({ size = D.s, color = D.c, strokeWidth = D.w, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 5v10m-4-4 4 4 4-4" />
        <path d="M4 22h16" />
    </svg>
);

export const IconSave: React.FC<IconProps> = ({ size = D.s, color = D.c, strokeWidth = D.w, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);

export const IconUndo: React.FC<IconProps> = ({ size = D.s, color = D.c, strokeWidth = D.w, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
);

export const IconRedo: React.FC<IconProps> = ({ size = D.s, color = D.c, strokeWidth = D.w, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 7v6h-6" />
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
);
