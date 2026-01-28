import { config } from '../config';
const API_URL = config.API_URL;

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
            console.error("Assistant API Error (Parse):", error);
            throw error;
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
            throw error;
        }
    },

    async confirmRequest(interpretation: Interpretation, token: string, userToken: string): Promise<any> {
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
    },
    async submitAction(actionType: string, payload: any, token: string): Promise<any> {
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
    }
};
