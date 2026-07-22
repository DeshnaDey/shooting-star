// Themed loading indicator: a little planet orbiting a glowing core.
// Shown while a page fetches its data, instead of a plain text label.
export default function SpaceLoader({ label }: { label?: string }) {
  return (
    <div className="space-loader">
      <div className="sl-core">
        <span className="sl-orbit">
          <span className="sl-planet" />
        </span>
      </div>
      {label && <div className="mono-label" style={{ marginTop: 14, color: "var(--text-dim)" }}>{label}</div>}
    </div>
  );
}
