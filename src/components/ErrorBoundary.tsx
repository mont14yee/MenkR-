import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="relative w-full h-[100dvh] bg-canvas flex flex-col items-center justify-center p-6 text-center max-w-[430px] mx-auto sm:border-x sm:border-bd-subtle shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-[24px] font-semibold text-tx-primary mb-2">Something went wrong</h1>
          <p className="text-[15px] text-tx-muted mb-8 max-w-[280px]">
            We encountered an unexpected error. Your data is saved locally, so it is safe to reload.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="h-14 px-8 rounded-full bg-tx-primary text-tx-inverse font-medium flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
          >
            <RefreshCw size={18} />
            <span>Reload App</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
