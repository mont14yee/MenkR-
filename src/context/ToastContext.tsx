import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);

  const showToast = useCallback((options: ToastOptions) => {
    setToast(options);
    setTimeout(() => {
      setToast((prev) => (prev === options ? null : prev));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-tx-primary text-tx-inverse px-4 py-3 rounded-full flex items-center gap-4 text-[14px] shadow-lg">
            <span>{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                onClick={() => {
                  toast.onAction!();
                  setToast(null);
                }}
                className="text-accent-primary font-medium uppercase text-[12px]"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
