import { useState } from "react";
import { Link } from "react-router-dom";
import { certEligible, certsForGoal, PRICING, type CertDef, type Pack } from "../../shared/certs.ts";
import { api, type Order } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useToast } from "../lib/toasts.tsx";
import { payWithRazorpay } from "../lib/checkout.ts";
import { formatDate } from "../lib/format.ts";
import TestRunner from "./TestRunner.tsx";

const { symbol } = PRICING;

/** Slide-in panel listing the certificates for the user's dream job. */
export default function CertSidebar({ onClose }: { onClose: () => void }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const me = user!;
  const certs = certsForGoal(me.goal!);
  const passed = me.progress.passedTests;
  const [buying, setBuying] = useState<{ pack: Pack; forCert?: CertDef } | null>(null);
  const [exam, setExam] = useState<CertDef | null>(null);

  async function unlock(cert: CertDef) {
    try {
      const { user } = await api.unlockCert(cert.id);
      setUser(user);
      toast({ emoji: "🔓", title: `${cert.title} unlocked`, body: "Take the exam whenever you're ready.", tone: "purple" });
    } catch (e) {
      toast({ emoji: "😵", title: (e as Error).message });
    }
  }

  async function afterPurchase(forCert?: CertDef) {
    setBuying(null);
    if (forCert) await unlock(forCert);
  }

  const savings = PRICING.single.amount * PRICING.bundle.credits - PRICING.bundle.amount;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer card" role="dialog" aria-label="Certifications">
        <div className="drawer-head">
          <h2>🎓 Certifications</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <p className="muted">
          Earn a certificate for each level of your {me.goal!.roleTitle} path. Each one unlocks when you pass that level's test, then you
          pass an AI-generated exam to get certified.
        </p>

        <div className="pricing">
          <button className="price-card" onClick={() => setBuying({ pack: "single" })}>
            <strong>{symbol}{PRICING.single.amount}</strong>
            <span>per certificate</span>
          </button>
          <button className="price-card best" onClick={() => setBuying({ pack: "bundle" })}>
            <em>Save {symbol}{savings}</em>
            <strong>{symbol}{PRICING.bundle.amount}</strong>
            <span>for 3 certificates</span>
          </button>
        </div>
        {me.certCredits > 0 && <p className="credits">🎟️ You have <b>{me.certCredits}</b> certificate credit{me.certCredits > 1 ? "s" : ""} to use.</p>}

        <ul className="cert-list">
          {certs.map((c) => {
            const earned = me.certificates.find((x) => x.certId === c.id);
            const unlocked = me.unlockedCerts.includes(c.id);
            const eligible = certEligible(c, passed);
            return (
              <li key={c.id} className={`cert-item ${earned ? "earned" : eligible ? "eligible" : "locked"}`}>
                <span className="cert-icon">{earned ? "🏅" : eligible ? c.icon : "🔒"}</span>
                <div className="cert-info">
                  <strong>{c.title}</strong>
                  <small>
                    {earned
                      ? `Earned ${formatDate(earned.issuedAt.slice(0, 10))} · ${earned.score}/${earned.total}`
                      : eligible
                        ? unlocked
                          ? "Exam unlocked · 15 questions · pass 75%"
                          : "Ready to unlock"
                        : c.id.endsWith(":capstone")
                          ? "Unlocks after passing every level test"
                          : `Unlocks at Level ${c.level} (pass its level test)`}
                  </small>
                </div>
                {earned ? (
                  <Link className="btn btn-gold btn-sm" to={`/certificate/${earned.id}`} onClick={onClose}>View</Link>
                ) : !eligible ? null : unlocked ? (
                  <button className="btn btn-green btn-sm" onClick={() => setExam(c)}>Take exam</button>
                ) : me.certCredits > 0 ? (
                  <button className="btn btn-purple btn-sm" onClick={() => unlock(c)}>Use credit</button>
                ) : (
                  <button className="btn btn-blue btn-sm" onClick={() => setBuying({ pack: "single", forCert: c })}>{symbol}{PRICING.single.amount}</button>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      {buying && <Checkout pack={buying.pack} forCert={buying.forCert} onClose={() => setBuying(null)} onPaid={() => afterPurchase(buying.forCert)} />}
      {exam && (
        <TestRunner
          kind="cert"
          refId={exam.id}
          intro={`${exam.title}: 15 questions, score at least 75% to get certified.`}
          onClose={() => setExam(null)}
          onFinished={(r) => setUser(r.user)}
        />
      )}
    </>
  );
}

function Checkout({ pack, forCert, onClose, onPaid }: { pack: Pack; forCert?: CertDef; onClose: () => void; onPaid: () => void }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [choice, setChoice] = useState<Pack>(pack);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demoOrder, setDemoOrder] = useState<Order | null>(null);
  const mode = user!.features.payments;

  async function start() {
    setBusy(true);
    setError("");
    try {
      const order = await api.createOrder(choice);
      if (order.provider === "razorpay") {
        setUser(await payWithRazorpay(order, user!));
        done(order);
      } else {
        setDemoOrder(order);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDemo() {
    if (!demoOrder) return;
    setBusy(true);
    try {
      const { user } = await api.verifyPayment(demoOrder.orderId, "", "");
      setUser(user);
      done(demoOrder);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function done(order: Order) {
    toast({ emoji: "🎉", title: "Payment successful!", body: `${order.credits} certificate credit${order.credits > 1 ? "s" : ""} added.`, tone: "green" });
    onPaid();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" role="dialog" aria-label="Checkout" onClick={(e) => e.stopPropagation()}>
        <button className="popup-close" aria-label="Close" onClick={onClose}>✕</button>
        <h2>🎓 Get certified</h2>
        {forCert && <p className="muted">For: <b>{forCert.title}</b></p>}
        {mode === "off" ? (
          <p className="form-error">Payments aren't available yet. Please check back soon.</p>
        ) : demoOrder ? (
          <>
            <div className="demo-pay">
              <p><b>Demo checkout.</b> No real money will be charged. Connect Razorpay keys on the server to take real payments.</p>
              <div className="demo-amount">{symbol}{demoOrder.amount}</div>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-green btn-xl btn-block" disabled={busy} onClick={confirmDemo}>
              {busy ? "Processing…" : `Pay ${symbol}${demoOrder.amount} (demo)`}
            </button>
          </>
        ) : (
          <>
            <div className="pack-options">
              {(["single", "bundle"] as Pack[]).map((p) => (
                <button key={p} className={`preset ${choice === p ? "selected" : ""}`} onClick={() => setChoice(p)}>
                  <span className="preset-emoji">{p === "single" ? "🎟️" : "🎟️🎟️🎟️"}</span>
                  <strong>{symbol}{PRICING[p].amount}</strong>
                  <small>{PRICING[p].label}</small>
                </button>
              ))}
            </div>
            <p className="muted small-print">
              Each credit unlocks one certification exam. {choice === "bundle" && forCert ? "One credit will be used now; the other two stay in your account." : ""}
            </p>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-green btn-xl btn-block" disabled={busy} onClick={start}>
              {busy ? "Opening checkout…" : `Continue to pay ${symbol}${PRICING[choice].amount}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
