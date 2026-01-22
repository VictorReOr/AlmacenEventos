import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import './styles/theme.css'; // Importación del tema industrial
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

console.log('Main script executing');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

