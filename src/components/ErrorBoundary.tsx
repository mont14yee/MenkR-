import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode | ((error: Error | null, reset: () => void) => ReactNode);
  onReset?: () => void;
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

  public resetError = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.resetError);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="relative w-full h-[100dvh] bg-canvas flex flex-col items-center justify-center p-6 text-center max-w-[430px] mx-auto sm:border-x sm:border-bd-subtle shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-[24px] font-semibold text-tx-primary mb-2">Something went wrong</h1>
          <p className="text-[15px] text-tx-muted mb-8 max-w-[280px]">
            We encountered an unexpected error. Your data is safely stored locally.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[240px]">
            <button
              onClick={this.resetError}
              className="h-12 w-full rounded-full bg-surface-neutral hover:bg-bd-subtle text-tx-primary font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw size={18} />
              <span>Try Again</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="h-12 w-full rounded-full bg-tx-primary text-tx-inverse font-medium flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
            >
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
