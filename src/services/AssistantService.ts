import { config } from '../config';
const API_URL = config.API_URL;

export interface AssistantResponse {
    text: string;
    intent: string;
    entities: { text: string, label: string }[];
    tokens?: string[];
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
                body: JSON.stringify({ text }),
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
    }
};
