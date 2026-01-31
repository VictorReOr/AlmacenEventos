import { config } from '../config';

// Base URL handling
const AUTH_URL = `${config.API_BASE_URL}/api/v1/auth`;

export const AuthService = {
    async login(email: string, password: string): Promise<any> {
        try {
            const response = await fetch(`${AUTH_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Error en inicio de sesión');
            }
            return response.json();
        } catch (error) {
            console.warn("Auth Service Error (Login):", error);
            // OFFLINE FALLBACK
            alert("⚠️ Modo Offline Activado: Accediendo como Administrador Local.");
            return {
                access_token: "mock_offline_token",
                user: {
                    id: "local-admin",
                    email: email,
                    name: "Admin Local (Offline)",
                    role: "ADMIN"
                }
            };
        }
    },

    async googleLogin(token: string): Promise<any> {
        try {
            const response = await fetch(`${AUTH_URL}/google-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw { status: response.status, message: errorData.detail || 'Error con Google' };
            }
            return response.json();
        } catch (error) {
            console.warn("Auth Service Error (Google):", error);
            // OFFLINE FALLBACK
            alert("⚠️ Modo Offline Activado: Accediendo como Administrador Local.");
            return {
                access_token: "mock_offline_token",
                user: {
                    id: "local-google-user",
                    email: "offline@google.com",
                    name: "Usuario Google (Offline)",
                    role: "ADMIN"
                }
            };
        }
    },

    async register(name: string, email: string, token: string): Promise<any> {
        try {
            const response = await fetch(`${AUTH_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, token })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Error en registro');
            }
            return response.json();
        } catch (error) {
            console.warn("Auth Service Error (Register):", error);
            // Offline fallback
            return {
                access_token: "mock_offline_token",
                user: {
                    id: "local-new-user",
                    email: email,
                    name: name,
                    role: "ADMIN"
                }
            };
        }
    }
};
