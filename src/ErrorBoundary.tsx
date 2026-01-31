import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    position: string;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, position: '' };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, position: 'Render' };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        // You can also log the error to an error reporting service
        this.setState({ position: errorInfo.componentStack || 'No stack trace available' });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#B71C1C', background: '#FFEBEE', height: '100vh', overflow: 'auto' }}>
                    <h1>⚠️ Algo salió mal</h1>
                    <h2 style={{ fontSize: '1.2rem', marginTop: 20 }}>{this.state.error?.message}</h2>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: 20, background: 'rgba(255,255,255,0.5)', padding: 20 }}>
                        {this.state.error?.stack}
                        <br />
                        {this.state.position}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: 20, padding: '10px 20px', background: '#333', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                        Recargar Página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
