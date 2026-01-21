import type { AlmacenState, Ubicacion } from '../types';

interface SheetResponse {
    status: 'success' | 'error' | 'empty';
    ubicaciones?: Record<string, Ubicacion>;
    geometry?: { x: number; y: number }[];
    message?: string;
}

export const GoogleSheetsService = {

    // Load data from Google Sheet
    async load(scriptUrl: string): Promise<AlmacenState | null> {
        try {
            const response = await fetch(scriptUrl, {
                method: 'GET',
            });

            const data: SheetResponse = await response.json();

            if (data.status === 'success' && data.ubicaciones) {
                return {
                    ubicaciones: data.ubicaciones,
                    geometry: data.geometry || [] // If null from sheet, use defaults later? handled in App.
                };
            } else if (data.status === 'empty') {
                console.log("Sheet is empty, using defaults.");
                return null; // Signal to use defaults
            } else {
                console.error("Error loading sheet:", data.message);
                throw new Error(data.message || "Unknown error loading sheet");
            }

        } catch (error) {
            console.error("Network error loading sheet:", error);
            throw error;
        }
    },

    // Save data to Google Sheet
    async save(scriptUrl: string, state: AlmacenState): Promise<void> {
        try {
            // Beacon API allows sending data even if tab closes, but fetch is fine for manual saves
            // We use no-cors if just trigger, but here we want response ideally.
            // Google Apps Script Web App REQUIRES 'text/plain' or similar to avoid preflight OPTIONS issues usually, 
            // OR use standard POST which follows redirects properly.

            // To handle CORS with Apps Script, simple GET/POST from browser usually works 
            // if the script is published as "Anyone".

            const response = await fetch(scriptUrl, {
                method: 'POST',
                // Apps Script POST requires string body. 
                // Content-Type text/plain prevents CORS preflight OPTIONS request which GAS doesn't handle well.
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(state)
            });

            const result = await response.json();
            if (result.status !== 'success') {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error("Error saving to sheet:", error);
            throw error;
        }
    }
};
