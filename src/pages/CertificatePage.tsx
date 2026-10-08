import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Certificate } from "../lib/api.ts";
import { formatDate } from "../lib/format.ts";
import Logo from "../components/Logo.tsx";

/** Public, printable certificate. Anyone with the link can verify it. */
export default function CertificatePage() {
  const { id = "" } = useParams();
  const [cert, setCert] = useState<(Certificate & { name: string }) | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.certificate(id).then(setCert).catch((e) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <div className="cert-page">
        <p className="form-error">{error}</p>
        <Link to="/">Go home</Link>
      </div>
    );
  if (!cert) return <div className="splash">🎓</div>;

  return (
    <div className="cert-page">
      <div className="cert-actions no-print">
        <Link to="/" className="btn btn-ghost btn-sm">← Back</Link>
        <button className="btn btn-green btn-sm" onClick={() => window.print()}>Download PDF</button>
      </div>
      <div className="certificate">
        <div className="cert-border">
          <Logo size={30} className="cert-logo" />
          <p className="cert-kicker">CERTIFICATE OF ACHIEVEMENT</p>
          <p>This certifies that</p>
          <h1>{cert.name}</h1>
          <p>has passed the certification exam for</p>
          <h2>{cert.title}</h2>
          <p className="muted">on the {cert.roleTitle} path, scoring {cert.score}/{cert.total}</p>
          <div className="cert-footer">
            <div>
              <b>{formatDate(cert.issuedAt.slice(0, 10))}</b>
              <small>Date issued</small>
            </div>
            <div className="cert-seal">🏅</div>
            <div>
              <b>{cert.id}</b>
              <small>Certificate ID</small>
            </div>
          </div>
        </div>
      </div>
      <p className="muted cert-verify no-print">Verify at {window.location.origin}/certificate/{cert.id}</p>
    </div>
  );
}
