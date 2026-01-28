const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const config = {
    // Automatically select URL based on environment
    API_URL: isLocal
        ? 'http://localhost:8000/api/v1/assistant'
        : 'https://almaceneventos-856058698301.europe-west1.run.app/api/v1/assistant',

    // Google Scripts URL (already in code, but good to centralize)
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz_XXXXXXXX/exec'
};
