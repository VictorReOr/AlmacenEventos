export const config = {
    // If in production (GitHub Pages), use the hosted backend URL (to be set later, e.g. Render)
    // If in development (localhost), use local Python server
    API_URL: import.meta.env.PROD
        ? 'https://warehouse-assistant-backend.onrender.com' // Placeholder for future Render deployment
        : 'http://localhost:8000',

    // Google Scripts URL (already in code, but good to centralize)
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz_XXXXXXXX/exec'
};
