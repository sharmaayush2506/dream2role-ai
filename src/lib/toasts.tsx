import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface Toast {
  id: number;
  emoji: string;
  title: string;
  body?: string;
  tone?: "green" | "orange" | "blue" | "purple" | "gold";
}

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId++;
    setToasts((all) => [...all.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone ?? "blue"}`} onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
            <span className="toast-emoji">{t.emoji}</span>
            <div>
              <strong>{t.title}</strong>
              {t.body && <p>{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
