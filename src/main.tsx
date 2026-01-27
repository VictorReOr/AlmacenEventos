import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import './styles/theme.css'; // Importación del tema industrial
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';

// TODO: Replace with actual Google Client ID from Cloud Console
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com";

console.log('Main script executing');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)

