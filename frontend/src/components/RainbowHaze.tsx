// Soft, colourful "stardust" halo — drop it behind a card/panel for a
// purple/gold/blue glow. Purely decorative; never intercepts pointer events.
export default function RainbowHaze({ className = "" }: { className?: string }) {
  return <div className={`rainbow-haze ${className}`} aria-hidden />;
}
