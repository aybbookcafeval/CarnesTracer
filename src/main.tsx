import React, { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AlertTriangle } from 'lucide-react';

import { Toaster } from 'sonner';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md">
            <AlertTriangle className="w-12 h-12 text-brand mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Algo salió mal</h1>
            <p className="text-slate-500 mb-6">Hubo un error inesperado en la aplicación. Intenta recargar la página o limpiar el almacenamiento local.</p>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 transition-colors"
            >
              Limpiar Datos y Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster position="top-center" expand={true} richColors />
    </ErrorBoundary>
  </StrictMode>,
);
