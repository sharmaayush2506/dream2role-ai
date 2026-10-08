import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "../components/Icon.tsx";

export type ThemePref = "light" | "dark" | "system";
const KEY = "d2r.theme";

export function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** "system" removes the attribute so the CSS follows the OS setting. */
export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable: theme lasts for this visit */
  }
}

const OPTIONS: { value: ThemePref; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

/** Icon button that opens a Light / Dark / System menu. */
export function ThemeMenu() {
  const [pref, setPref] = useState<ThemePref>(readTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function choose(p: ThemePref) {
    applyTheme(p);
    setPref(p);
    setOpen(false);
  }

  const current = OPTIONS.find((o) => o.value === pref)!;
  return (
    <div className="theme-menu" ref={ref}>
      <button className="icon-btn theme-trigger" aria-label={`Theme: ${current.label}`} aria-haspopup="menu" aria-expanded={open} title="Theme" onClick={() => setOpen(!open)}>
        <Icon name={current.icon} />
      </button>
      {open && (
        <div className="theme-options card" role="menu">
          {OPTIONS.map((o) => (
            <button key={o.value} role="menuitemradio" aria-checked={pref === o.value} className={pref === o.value ? "active" : ""} onClick={() => choose(o.value)}>
              <Icon name={o.icon} size={16} />
              {o.label}
              {pref === o.value && <Icon name="check" size={16} className="theme-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
