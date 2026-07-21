import { useLocation } from "react-router-dom";
import { pageThemeFor } from "../lib/theme";
import SpaceObject from "./SpaceObject";
import { MonoLabel } from "./Hud";

// The current page's meaningful space object, used as a loading indicator so the
// graphics do double duty during data fetches instead of sitting behind content.
export default function SpaceLoader({ label }: { label?: string }) {
  const { pathname } = useLocation();
  const theme = pageThemeFor(pathname);
  return (
    <div className="space-loader">
      <div className="space-loader-orb">
        <SpaceObject variant={theme.glyph} accent={theme.accent} accent2={theme.accent2} size={132} />
      </div>
      {label && <MonoLabel style={{ color: "var(--text-dim)" }}>{label}</MonoLabel>}
    </div>
  );
}
