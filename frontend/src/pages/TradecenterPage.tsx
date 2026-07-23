import { useEffect, useState } from "react";
import { couponApi, ApiReward, ApiError } from "../lib/api";
import { HudButton, HudPanel, MonoLabel, useToast } from "../components/Hud";
import RainbowHaze from "../components/RainbowHaze";
import NebulaDrift from "../components/NebulaDrift";

const CATEGORY_LABELS: Record<string, string> = {
  food: "FOOD", tech: "TECH", entertainment: "ENTERTAINMENT", books: "BOOKS",
};

function RewardCard({
  reward, balance, onRedeem,
}: {
  reward: ApiReward;
  balance: number | null;
  onRedeem: (r: ApiReward) => void;
}) {
  const canAfford = balance !== null && balance >= reward.kp_cost;
  const disabled = !reward.in_stock || !canAfford;

  return (
    <HudPanel style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <MonoLabel style={{ color: "var(--pink-soft)" }}>
            {reward.brand?.toUpperCase() ?? "REWARD"} · {CATEGORY_LABELS[reward.category ?? ""] ?? "GENERAL"}
          </MonoLabel>
          <h3 className="display-title" style={{ fontSize: 20, fontStyle: "italic", marginTop: 4 }}>
            {reward.name}
          </h3>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 20, color: "var(--purple-pale)", fontFamily: "var(--font-mono)" }}>
            {reward.kp_cost} KP
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-dim)" }}>{reward.detail}</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
          {!reward.in_stock
            ? "OUT OF STOCK"
            : reward.verified_hours_ago != null
              ? `VERIFIED ${reward.verified_hours_ago < 1 ? "<1H" : `${Math.round(reward.verified_hours_ago)}H`} AGO`
              : "RECENTLY VERIFIED"}
        </span>
        <HudButton
          className={disabled ? "disabled" : ""}
          disabled={disabled}
          onClick={() => onRedeem(reward)}
        >
          {!reward.in_stock ? "UNAVAILABLE" : !canAfford ? "NOT ENOUGH KP" : "⇄ REDEEM"}
        </HudButton>
      </div>
    </HudPanel>
  );
}

export default function TradecenterPage() {
  const toast = useToast();
  const [rewards, setRewards] = useState<ApiReward[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirming, setConfirming] = useState<ApiReward | null>(null);
  const [lastCode, setLastCode] = useState<{ code: string; brand: string; title: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  function load() {
    couponApi.rewards().then(setRewards).catch(() => setOffline(true));
    couponApi.myPoints().then((r) => setBalance(r.kp_balance)).catch(() => setOffline(true));
  }

  useEffect(load, []);

  async function handleConfirm() {
    if (!confirming) return;
    setRedeeming(true);
    try {
      const result = await couponApi.redeem(confirming.id);
      setBalance(result.kp_balance_after);
      setLastCode({ code: result.code, brand: result.brand, title: result.title });
      toast(`Redeemed: ${result.title}`);
      setConfirming(null);
      load(); // refresh stock/balance from the server, don't trust local state alone
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong";
      toast(`⚠ ${msg}`);
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="page-scroll">
      <NebulaDrift />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 28px 80px 170px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div>
            <MonoLabel style={{ color: "var(--pink-soft)" }}>KNOWLEDGE POINTS EXCHANGE</MonoLabel>
            <h1 className="display-title" style={{ fontSize: 38, fontStyle: "italic", marginTop: 4 }}>
              Tradecenter
            </h1>
          </div>
          <div style={{ position: "relative" }}>
            <RainbowHaze />
            <HudPanel style={{ padding: "12px 20px" }}>
              <MonoLabel>YOUR BALANCE</MonoLabel>
              <div style={{ fontSize: 26, color: "var(--pink-soft)", fontFamily: "var(--font-mono)" }}>
                {balance ?? "—"} KP
              </div>
            </HudPanel>
          </div>
        </div>

        {offline && (
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em",
            color: "var(--pink-soft)", marginBottom: 18,
          }}>
            ⚠ COUPON SERVICE OFFLINE — CHECK IT'S RUNNING ON PORT 8001
          </p>
        )}

        {lastCode && (
          <HudPanel purple style={{ marginBottom: 20 }}>
            <MonoLabel style={{ color: "var(--pink-soft)" }}>REDEMPTION CONFIRMED</MonoLabel>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
              {lastCode.brand} — {lastCode.title}
            </p>
            <div style={{
              marginTop: 8, padding: "10px 16px", display: "inline-block",
              fontFamily: "var(--font-mono)", fontSize: 18, letterSpacing: "0.08em",
              color: "var(--white-core)", background: "rgba(213,139,232,0.12)",
              border: "1px solid var(--pink)",
            }}>
              {lastCode.code}
            </div>
          </HudPanel>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {rewards?.map((r) => (
            <RewardCard key={r.id} reward={r} balance={balance} onRedeem={setConfirming} />
          ))}
          {!rewards && !offline && <MonoLabel style={{ color: "var(--text-faint)" }}>LOADING…</MonoLabel>}
          {rewards && rewards.length === 0 && (
            <MonoLabel style={{ color: "var(--text-faint)" }}>NO REWARDS CURRENTLY AVAILABLE</MonoLabel>
          )}
        </div>
      </div>

      {confirming && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(4,8,20,0.7)",
          display: "grid", placeItems: "center", zIndex: 50,
        }}>
          <div style={{ width: 420, maxWidth: "90vw" }}>
            <HudPanel>
              <MonoLabel style={{ color: "var(--pink-soft)" }}>CONFIRM REDEMPTION</MonoLabel>
              <h2 className="display-title" style={{ fontSize: 22, fontStyle: "italic", margin: "6px 0 12px" }}>
                {confirming.brand} — {confirming.name}
              </h2>
              <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 14 }}>
                This will spend <strong style={{ color: "var(--pink-soft)" }}>{confirming.kp_cost} KP</strong>.
                Balance after: <strong>{(balance ?? 0) - confirming.kp_cost} KP</strong>.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <HudButton onClick={handleConfirm} disabled={redeeming}>
                  {redeeming ? "REDEEMING…" : "✓ CONFIRM"}
                </HudButton>
                <HudButton variant="ghost" onClick={() => setConfirming(null)} disabled={redeeming}>
                  CANCEL
                </HudButton>
              </div>
            </HudPanel>
          </div>
        </div>
      )}
    </div>
  );
}
