import { useNavigate } from "react-router-dom";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";
import RainbowHaze from "../components/RainbowHaze";

export default function TradecenterPage() {
  const navigate = useNavigate();
  return (
    <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
      <div style={{ width: 460, maxWidth: "90vw", position: "relative" }}>
        <RainbowHaze style={{ inset: "-54px", width: "auto", height: "auto", opacity: 0.4 }} />
        <HudPanel style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div className="portal-dot" />
            <MonoLabel style={{ color: "var(--pink-soft)" }}>SECTOR UNDER CONSTRUCTION</MonoLabel>
          </div>
          <h1 className="display-title" style={{ fontSize: 38, fontStyle: "italic", marginBottom: 10 }}>
            Tradecenter
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-dim)", marginBottom: 18 }}>
            The exchange where Knowledge Points earned from tests will trade for
            real-world coupon codes and cosmetic unlocks. The points ledger and the
            coupon scraper dock here soon.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <HudButton className="disabled" disabled>⇄ TRADING OFFLINE</HudButton>
            <HudButton variant="ghost" onClick={() => navigate("/")}>BACK TO CONSTELLATION</HudButton>
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
