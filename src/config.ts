const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const config = {
    // Automatically select URL based on environment
    API_BASE_URL: isLocal
        ? '' // Use relative path to leverage Vite Proxy (avoids CORS & Port issues)
        : 'https://warehouse-backend-ag3evcbxeq-no.a.run.app',

    // Google Scripts URL (already in code, but good to centralize)
    // Google Scripts URL (Corrected from App.tsx defaults)
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwPJThfJGQXx1J-TnRHtgZlh_TmrpZXBvMDTyomvy6BOnL9ebuZuYmt_ZH4hQ74DiAh/exec'
};

console.log("🔧 Config loaded. API Base URL:", config.API_BASE_URL);
