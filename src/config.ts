const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.startsWith('192.168.') ||
                window.location.hostname.startsWith('10.');

export const config = {
    // Seleccionar URL automáticamente basada en el entorno
    API_BASE_URL: isLocal
        ? 'https://warehouse-backend-ag3evcbxeq-no.a.run.app' // Usar backend real para evitar el error sin backend local
        : 'https://warehouse-backend-ag3evcbxeq-no.a.run.app',

    // URL de Google Scripts (ya en el código, pero bueno centralizarla)
    // URL de Google Scripts (Corregido de los valores por defecto de App.tsx)
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwPJThfJGQXx1J-TnRHtgZlh_TmrpZXBvMDTyomvy6BOnL9ebuZuYmt_ZH4hQ74DiAh/exec'
};

console.log("🔧 Config loaded. API Base URL:", config.API_BASE_URL);
