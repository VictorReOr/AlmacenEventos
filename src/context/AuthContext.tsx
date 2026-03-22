import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";

interface User {
    email: string;
    role: 'ADMIN' | 'USER' | 'VISITOR';
    name?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, userData: User) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load from localStorage
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('auth_user');

        if (storedToken && storedUser) {
            try {
                const decoded: any = jwtDecode(storedToken);
                if (decoded.exp * 1000 > Date.now()) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                } else {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('auth_user');
                }
            } catch (e) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            }
        }
        setIsLoading(false);
    }, []);

    const login = (newToken: string, userData: User) => {
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUser(null);
    };

    // --- INACTIVITY AUTO-LOGOUT (60 min) ---
    useEffect(() => {
        if (!user) return; // Only track inactivity when logged in

        const INACTIVITY_LIMIT = 60 * 60 * 1000; // 60 minutes in ms
        let inactivityTimer: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                logout();
                alert('Tu sesión ha expirado por inactividad (60 min). Por favor, vuelve a iniciar sesión.');
            }, INACTIVITY_LIMIT);
        };

        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
        events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
        resetTimer(); // Start the timer immediately

        return () => {
            clearTimeout(inactivityTimer);
            events.forEach(ev => window.removeEventListener(ev, resetTimer));
        };
    }, [user]); // Re-register whenever user state changes

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
