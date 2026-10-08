import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.tsx";
import Landing from "./pages/Landing.tsx";
import Setup from "./pages/Setup.tsx";
import Learn from "./pages/Learn.tsx";
import Friends from "./pages/Friends.tsx";
import AppShell from "./components/AppShell.tsx";
import { RocketMark } from "./components/Logo.tsx";
import Career from "./pages/Career.tsx";
import CertificatePage from "./pages/CertificatePage.tsx";

function Protected({ children, needsGoal = true }: { children: ReactNode; needsGoal?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash"><RocketMark size={48} /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (needsGoal && !user.goal) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash"><RocketMark size={48} /></div>;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={user.goal ? "/learn" : "/setup"} replace /> : <Landing />} />
      <Route path="/setup" element={<Protected needsGoal={false}><Setup /></Protected>} />
      <Route path="/learn" element={<Protected><AppShell><Learn /></AppShell></Protected>} />
      <Route path="/friends" element={<Protected><AppShell><Friends /></AppShell></Protected>} />
      <Route path="/career" element={<Protected><AppShell><Career /></AppShell></Protected>} />
      <Route path="/certificate/:id" element={<CertificatePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
