import { CSSProperties } from "react";

// Soft, blurred multi-colour glow (à la the Stardust button haze). Drop it into
// any position:relative container to add a lively colourful halo behind content.
export default function RainbowHaze({ style }: { style?: CSSProperties }) {
  return <div className="rainbow-haze" style={style} aria-hidden />;
}
