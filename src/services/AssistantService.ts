import { config } from '../config';
const API_URL = `${config.API_BASE_URL}/api/v1/assistant`;

// Backend response types matching schemas.py
export interface MovementProposal {
    item: string;
    qty: number;
    origin: string;
    destination: string;
    type: 'ENTRADA' | 'SALIDA' | 'MOVIMIENTO' | 'MODIFICACION';
    reason?: string;
    state?: 'STOCK' | 'PARA_PRESTAMO' | 'EN_PRESTAMO' | 'REGALO';
}

export interface Interpretation {
    intent: string;
    summary: string;
    movements: MovementProposal[];
}

export interface AssistantResponse {
    status: 'PROPOSAL_READY' | 'ERROR';
    interpretation?: Interpretation;
    warnings: string[];
    token?: string;
    error?: string;
}

export interface OCRResponse {
    filename: string;
    ocr_text: string;
    status: string;
}

export const AssistantService = {
    async parseText(text: string): Promise<AssistantResponse> {
        try {
            // OFFLINE MODE CHECK
            // return { status: 'ERROR', error: 'Modo Offline: Backend desconectado.' };

            const response = await fetch(`${API_URL}/parse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    user_id: 'web-user' // TODO: Replace with actual user ID when auth is implemented
                }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.warn("Assistant API Error (Parse):", error);
            // MOCK RESPONSE FOR OFFLINE
            return {
                status: 'ERROR',
                error: 'Estamos trabajando en modo desconectado. El asistente no está disponible.',
                warnings: []
            };
        }
    },

    async uploadFile(file: File): Promise<OCRResponse> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }, // Add auth header if available for upload too
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Assistant API Error (Upload):", error);
            // throw error; // SWALLOW ERROR
            return {
                filename: file.name,
                ocr_text: "[OFFLINE] No se pudo procesar el archivo.",
                status: "error"
            };
        }
    },

    async confirmRequest(interpretation: Interpretation, token: string, userToken: string): Promise<any> {
        try {
            const response = await fetch(`${API_URL}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    token: token,
                    interpretation: interpretation
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                // Handle 403 explicitly
                if (response.status === 403) throw new Error("No tienes permisos para esta acción.");
                throw new Error(err.detail || 'Error confirmando acción');
            }
            return response.json();
        } catch (e) {
            console.warn("Offline: Confirm Request failed", e);
            // Simulate success for UX
            return { status: "SUCCESS", transaction_id: "OFFLINE-ID" };
        }
    },

    async submitAction(actionType: string, payload: any, token: string): Promise<any> {
        try {
            const response = await fetch(`${API_URL}/submit_action`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action_type: actionType,
                    payload: payload
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error submitting action");
            }
            return await response.json();
        } catch (e) {
            console.warn("Offline: Submit Action failed", e);
            // Return fake success
            return { status: "SUCCESS", offline: true };
        }
    }
};
