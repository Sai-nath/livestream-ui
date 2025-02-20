// API Configuration
const getBaseUrl = () => {
    const networkUrl = import.meta.env.VITE_API_URL;
    const allowLocal = import.meta.env.VITE_ALLOW_LOCAL === 'true';
    const isLocalhost = window.location.hostname === 'localhost';
    
    return isLocalhost && allowLocal ? 'http://localhost:5000' : networkUrl;
};

export const API_URL = getBaseUrl();
export const SOCKET_URL = getBaseUrl();

// Authentication Configuration
export const TOKEN_KEY = 'user_token';
export const AUTH_HEADER = 'Authorization';

// Map Configuration
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Feature Flags
export const FEATURES = {
    GOOGLE_MAPS: true,
    LIVE_STREAMING: true,
    NOTIFICATIONS: true
};

// Route Paths
export const ROUTES = {
    LOGIN: '/login',
    DASHBOARD: '/dashboard',
    CLAIMS: '/claims',
    INVESTIGATIONS: '/investigations',
    STREAMS: '/streams'
};

// API Endpoints
export const ENDPOINTS = {
    AUTH: {
        LOGIN: '/api/auth/login',
        REFRESH: '/api/auth/refresh',
        LOGOUT: '/api/auth/logout'
    },
    CLAIMS: {
        LIST: '/api/claims',
        CREATE: '/api/claims',
        GET: (id) => `/api/claims/${id}`,
        UPDATE: (id) => `/api/claims/${id}`,
        DELETE: (id) => `/api/claims/${id}`,
        ASSIGN: (id) => `/api/claims/${id}/assign`
    },
    STREAMS: {
        START: '/api/streams/start',
        END: '/api/streams/end',
        JOIN: (id) => `/api/streams/${id}/join`
    }
};
