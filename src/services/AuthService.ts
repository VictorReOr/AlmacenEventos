import { config } from '../config';

// Base URL handling: config.API_URL points to .../api/v1/assistant
// We need .../api/v1/auth
const AUTH_URL = config.API_URL.replace('/assistant', '/auth');

export const AuthService = {
    async login(email: string, password: string): Promise<any> {
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
    },

    async googleLogin(token: string): Promise<any> {
        const response = await fetch(`${AUTH_URL}/google-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Error en inicio de sesión con Google');
        }
        return response.json();
    }
};
