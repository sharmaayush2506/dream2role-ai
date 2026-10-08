import { useEffect, useState } from "react";
import { api, type PublicCard } from "../lib/api.ts";
import { useToast } from "../lib/toasts.tsx";

const SNOOZE_KEY = "d2r.suggestSnooze";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
}

/** Pops up "people you may know" a few seconds after landing, at most once a day. */
export default function SuggestionPopup() {
  const [people, setPeople] = useState<PublicCard[]>([]);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const toast = useToast();

  useEffect(() => {
    if (snoozed()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { suggestions } = await api.suggestions();
        if (!cancelled && suggestions.length) {
          setPeople(suggestions.slice(0, 3));
          setOpen(true);
        }
      } catch {
        /* not worth bothering the user about */
      }
    }, 3500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  function close() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function add(p: PublicCard) {
    await api.addFriend(p.id);
    setAdded(new Set(added).add(p.id));
    toast({ emoji: "💌", title: `Friend request sent to ${p.name.split(" ")[0]}`, tone: "purple" });
  }

  if (!open) return null;
  return (
    <div className="popup-suggest card" role="dialog" aria-label="People you may know">
      <button className="popup-close" aria-label="Close" onClick={close}>✕</button>
      <h4>👋 Learn together!</h4>
      <p className="muted">These people are on Dream2Role too. Streaks are way more fun with friends cheering you on.</p>
      {people.map((p) => (
        <div key={p.id} className="person-row">
          <span className="avatar">{p.avatar}</span>
          <div className="person-info">
            <strong>{p.name}</strong>
            <small>{p.reason}</small>
          </div>
          <button className="btn btn-blue btn-sm" disabled={added.has(p.id)} onClick={() => add(p)}>
            {added.has(p.id) ? "Sent ✓" : "Add"}
          </button>
        </div>
      ))}
    </div>
  );
}
