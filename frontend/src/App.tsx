import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ConstellationPage from "./pages/ConstellationPage";
import SolarSystemPage from "./pages/SolarSystemPage";
import TestPage from "./pages/TestPage";
import VisualiserPage from "./pages/VisualiserPage";
import ConceptPage from "./pages/ConceptPage";
import ArcadePage from "./pages/ArcadePage";
import TradecenterPage from "./pages/TradecenterPage";
import ProfilePage from "./pages/ProfilePage";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import SpaceFX from "./components/SpaceFX";
import { ToastProvider } from "./components/Hud";
import { auth } from "./lib/api";

function Guard({ children }: { children: React.ReactNode }) {
  if (!auth.isLoggedIn()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Chrome() {
  const { pathname } = useLocation();
  const showSidebar = pathname !== "/login" && auth.isLoggedIn();
  return (
    <>
      <SpaceFX />
      {showSidebar && <Sidebar />}
      <Routes>
        <Route path="/login" element={auth.isLoggedIn() ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<Guard><ConstellationPage /></Guard>} />
        <Route path="/system/:starId" element={<Guard><SolarSystemPage /></Guard>} />
        <Route path="/system/:starId/test/:attemptId" element={<Guard><TestPage /></Guard>} />
        <Route path="/system/:starId/analysis" element={<Guard><VisualiserPage /></Guard>} />
        <Route path="/system/:starId/concept/:subtopicId" element={<Guard><ConceptPage /></Guard>} />
        <Route path="/arcade" element={<Guard><ArcadePage /></Guard>} />
        <Route path="/system/:starId/arcade" element={<Guard><ArcadePage /></Guard>} />
        <Route path="/trade" element={<Guard><TradecenterPage /></Guard>} />
        <Route path="/profile" element={<Guard><ProfilePage /></Guard>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Chrome />
      </BrowserRouter>
    </ToastProvider>
  );
}
