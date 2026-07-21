import { ButtonHTMLAttributes, ReactNode, createContext, useCallback, useContext, useState } from "react";

// ─── HUD building blocks (styled per the sci-fi HUD reference) ──────────────

export function HudButton({
  children,
  variant = "pink",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "pink" | "purple" | "ghost" }) {
  const v = variant === "pink" ? "" : variant;
  return (
    <button className={`hud-btn ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function HudPanel({
  children,
  purple = false,
  corners = true,
  className = "",
  style,
}: {
  children: ReactNode;
  purple?: boolean;
  corners?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`hud-panel ${purple ? "purple" : ""} ${corners ? "hud-corners" : ""} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function MonoLabel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <span className="mono-label" style={style}>{children}</span>;
}

// ─── Toast (for the non-functional test portal notice) ──────────────────────

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
