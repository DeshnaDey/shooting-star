import { useEffect, useMemo, useState } from "react";
import { couponApi, ApiReward, ApiError } from "../lib/api";
import { HudButton, HudPanel, MonoLabel, useToast } from "../components/Hud";
import RainbowHaze from "../components/RainbowHaze";
<<<<<<< HEAD
import NebulaDrift from "../components/NebulaDrift";
=======
>>>>>>> 706ee192ce33f62e2e5ee8edec5e22254dec73c5
import SpaceLoader from "../components/SpaceLoader";

const CATEGORY_LABELS: Record<string, string> = {
  food: "FOOD", tech: "TECH", entertainment: "ENTERTAINMENT",
  books: "BOOKS", beauty: "BEAUTY", cashback: "CASHBACK",
};

// ─── Tradecenter's own decorative layer: a few big soft drifting orbs plus a
// scatter of twinkling stars. Self-contained here (not a shared component)
// so it can't go missing if only this file gets copied in. Fixed, hand-
// placed positions - not random, so there's no layout shift or hydration
// mismatch on every reload.
const TRADE_ORBS = [
  { top: "8%",  left: "62%", size: 210, color: "var(--blue)",   dur: "22s", delay: "0s" },
  { top: "58%", left: "84%", size: 150, color: "var(--purple)", dur: "26s", delay: "-6s" },
  { top: "72%", left: "20%", size: 170, color: "var(--gold)",   dur: "30s", delay: "-14s" },
  { top: "18%", left: "12%", size: 120, color: "var(--pink)",   dur: "24s", delay: "-9s" },
];
const TRADE_STARS = [
  { top: "12%", left: "40%" }, { top: "24%", left: "78%" }, { top: "34%", left: "8%" },
  { top: "46%", left: "58%" }, { top: "6%",  left: "88%" }, { top: "64%", left: "44%" },
  { top: "78%", left: "70%" }, { top: "82%", left: "30%" }, { top: "52%", left: "94%" },
  { top: "38%", left: "22%" }, { top: "90%", left: "54%" }, { top: "16%", left: "60%" },
];

function TradeParticles() {
  return (
    <div className="trade-particles" aria-hidden>
      {TRADE_ORBS.map((o, i) => (
        <span
          key={i}
          className="trade-orb"
          style={{
            top: o.top, left: o.left, width: o.size, height: o.size,
            background: o.color,
            animationDuration: o.dur,
            animationDelay: o.delay,
          }}
        />
      ))}
      {TRADE_STARS.map((s, i) => (
        <span key={i} className="trade-star" style={{ top: s.top, left: s.left, animationDelay: `${(i % 6) * 0.7}s` }} />
      ))}
    </div>
  );
}

// A reward is "unlock soon" once the gap between balance and cost is small -
// close enough that a couple more tests would get you there.
const UNLOCK_SOON_GAP = 200;
// A reward counts as "expiring soon" once it's within this window.
const EXPIRING_SOON_HOURS = 72;
const REFRESH_COST_KP = 50;

// ─── Brand "logo" - real favicon pulled from the brand's own domain via
// Google's public favicon service (free, no key, no signup - Clearbit's old
// logo API shut down in Dec 2025). Falls back to a colour-hashed monogram
// if a brand has no mapped domain, or if the image fails to load - this
// fallback is also what internal (non-external-brand) rewards like the
// cashback vouchers always use, since there's no real site to pull from.
const BRAND_DOMAINS: Record<string, string> = {
  "Zomato": "zomato.com",
  "Croma": "croma.com",
  "BookMyShow": "bookmyshow.com",
  "Myntra": "myntra.com",
  "Swiggy Instamart": "swiggy.com",
  "Flipkart": "flipkart.com",
};

function brandHue(brand: string): number {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) >>> 0;
  return hash % 360;
}
function BrandLogo({ brand }: { brand: string }) {
  const domain = BRAND_DOMAINS[brand];
  const [imgFailed, setImgFailed] = useState(false);
  const hue = brandHue(brand);

  if (domain && !imgFailed) {
    return (
      <div className="trade-logo trade-logo-img">
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt={brand}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  return (
    <div className="trade-logo" style={{ background: `hsl(${hue}, 68%, 62%)` }}>
      {brand.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Countdown, ticking every 30s (minute precision is plenty for this) ────
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
function formatCountdown(expiresAt: string, now: number): { text: string; tight: boolean } {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return { text: "EXPIRED", tight: true };
  const hours = ms / 3_600_000;
  const tight = hours <= 24;
  if (hours >= 24) return { text: `${Math.floor(hours / 24)}D ${Math.floor(hours % 24)}H LEFT`, tight };
  if (hours >= 1) return { text: `${Math.floor(hours)}H ${Math.floor((ms % 3_600_000) / 60_000)}M LEFT`, tight };
  return { text: `${Math.floor(ms / 60_000)}M LEFT`, tight };
}

function RewardCard({
  reward, balance, now, onRedeem,
}: {
  reward: ApiReward;
  balance: number | null;
  now: number;
  onRedeem: (r: ApiReward) => void;
}) {
  const canAfford = balance !== null && balance >= reward.kp_cost;
  const disabled = !reward.in_stock || !canAfford;
  const gap = balance !== null ? reward.kp_cost - balance : Infinity;
  const isUnlockSoon = !canAfford && gap > 0 && gap <= UNLOCK_SOON_GAP;
  const countdown = reward.expires_at ? formatCountdown(reward.expires_at, now) : null;
  const isExpiringSoon = countdown && !countdown.text.startsWith("EXPIRED") &&
    (new Date(reward.expires_at!).getTime() - now) / 3_600_000 <= EXPIRING_SOON_HOURS;
<<<<<<< HEAD

  return (
    <div className={`trade-card ${reward.kind === "voucher" ? "voucher" : ""}`}>
=======

  // Tint the card with the hue of its brand logo, kept subtle/semi-opaque so
  // text stays legible. Same hue the monogram fallback logo uses. Vouchers
  // (scratch cards) get a bright, shiny gold sheen instead - a diagonal
  // gradient so they catch the light rather than reading as flat brown.
  const isVoucher = reward.kind === "voucher";
  const hue = isVoucher ? 46 : brandHue(reward.brand ?? reward.name);
  const cardTint = {
    ["--card-hue" as any]: String(hue),
    background: isVoucher
      ? "linear-gradient(135deg, hsla(50, 95%, 68%, 0.26) 0%, hsla(44, 88%, 58%, 0.14) 45%, hsla(40, 80%, 52%, 0.10) 100%)"
      : `hsla(${hue}, 62%, 55%, 0.16)`,
  };

  return (
    <div className={`trade-card ${reward.kind === "voucher" ? "voucher" : ""}`} style={cardTint}>
>>>>>>> 706ee192ce33f62e2e5ee8edec5e22254dec73c5
      {isUnlockSoon && <span className="trade-badge unlock">UNLOCK SOON</span>}
      {!isUnlockSoon && isExpiringSoon && <span className="trade-badge expiring">EXPIRING</span>}

      <div className="trade-card-head">
        <BrandLogo brand={reward.brand ?? reward.name} />
        <div style={{ minWidth: 0 }}>
          <div className="trade-card-brand">
            {(reward.brand ?? "REWARD").toUpperCase()} · {CATEGORY_LABELS[reward.category ?? ""] ?? "GENERAL"}
          </div>
          <div className="trade-card-name">{reward.name}</div>
        </div>
      </div>

      <p className="trade-card-detail">{reward.detail}</p>

      {countdown && (
        <div className={`trade-countdown ${countdown.tight ? "tight" : ""}`}>⏳ {countdown.text}</div>
      )}

      <div className="trade-card-foot">
        <span className="trade-kp">{reward.kp_cost} KP</span>
        <HudButton className={disabled ? "disabled" : ""} disabled={disabled} onClick={() => onRedeem(reward)}>
          {!reward.in_stock ? "UNAVAILABLE" : !canAfford ? (isUnlockSoon ? `NEED ${gap}` : "NOT ENOUGH") : reward.kind === "voucher" ? "✦ SCRATCH" : "⇄ REDEEM"}
        </HudButton>
      </div>
    </div>
  );
}

export default function TradecenterPage() {
  const toast = useToast();
  const now = useNow();

  const [rewards, setRewards] = useState<ApiReward[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirming, setConfirming] = useState<ApiReward | null>(null);
  const [lastCode, setLastCode] = useState<{ code: string; brand: string; title: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState<"all" | "coupon" | "voucher">("all");
  const [specialTab, setSpecialTab] = useState<"all" | "unlock" | "expiring">("all");

  const sparkSeeds = useMemo(() => {
    const colors = ["#6ec9e8", "#9d6fc8", "#d58be8", "#f6d48f"];
    return Array.from({ length: 16 }, (_, i) => ({
      left: (i * 37 + 5) % 100,
      size: 2 + ((i * 13) % 5),
      color: colors[i % colors.length],
      duration: 14 + ((i * 7) % 12),
      delay: -((i * 3) % 20),
    }));
  }, []);

  function load() {
    couponApi.rewards().then(setRewards).catch(() => setOffline(true));
    couponApi.myPoints().then((r) => setBalance(r.kp_balance)).catch(() => setOffline(true));
  }
  useEffect(load, []);

  const categories = useMemo(
    () => Array.from(new Set((rewards ?? []).map((r) => r.category).filter(Boolean))) as string[],
    [rewards]
  );

  const isUnlockSoon = (r: ApiReward) => {
    if (balance === null) return false;
    const gap = r.kp_cost - balance;
    return gap > 0 && gap <= UNLOCK_SOON_GAP;
  };
  const isExpiringSoon = (r: ApiReward) => {
    if (!r.expires_at) return false;
    const hoursLeft = (new Date(r.expires_at).getTime() - now) / 3_600_000;
    return hoursLeft > 0 && hoursLeft <= EXPIRING_SOON_HOURS;
  };

  const filtered = useMemo(() => {
    return (rewards ?? []).filter((r) => {
      if (search.trim() && !(r.brand ?? r.name).toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (category !== "all" && r.category !== category) return false;
      if (kind !== "all" && r.kind !== kind) return false;
      if (specialTab === "unlock" && !isUnlockSoon(r)) return false;
      if (specialTab === "expiring" && !isExpiringSoon(r)) return false;
      return true;
    });
  }, [rewards, search, category, kind, specialTab, balance, now]);

  const isFiltering = search.trim() !== "" || category !== "all" || kind !== "all" || specialTab !== "all";

  const coupons = useMemo(() => (rewards ?? []).filter((r) => r.kind === "coupon"), [rewards]);
  const vouchers = useMemo(() => (rewards ?? []).filter((r) => r.kind === "voucher"), [rewards]);

  async function handleConfirm() {
    if (!confirming) return;
    setRedeeming(true);
    try {
      const result = await couponApi.redeem(confirming.id);
      setBalance(result.kp_balance_after);
      setLastCode({ code: result.code, brand: result.brand, title: result.title });
      toast(`Redeemed: ${result.title}`);
      setConfirming(null);
      load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong";
      toast(`⚠ ${msg}`);
    } finally {
      setRedeeming(false);
    }
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const r = await couponApi.refresh();
      setBalance(r.kp_balance_after);
      toast(`Catalog refreshed · ${r.refreshed_count} listings re-verified · −${r.kp_spent} KP`);
      load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Refresh failed";
      toast(`⚠ ${msg}`);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="page-scroll trade-bg trade-page">
      <div className="page-orb-intro" style={{ ["--hue" as any]: "var(--blue)" }} />
<<<<<<< HEAD
      <NebulaDrift variant="vortex" />
=======
>>>>>>> 706ee192ce33f62e2e5ee8edec5e22254dec73c5
      <div className="trade-nebula-cloud" />
      <TradeParticles />
      <div className="trade-sparks">
        {sparkSeeds.map((s, i) => (
          <span
            key={i}
            className="trade-spark"
            style={{
              left: `${s.left}%`,
              width: s.size, height: s.size,
              background: s.color,
              boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="trade-topbar">
        <div>
          <MonoLabel style={{ color: "var(--pink-soft)" }}>KNOWLEDGE POINTS EXCHANGE</MonoLabel>
          <h1 className="display-title" style={{ fontSize: 34, fontStyle: "italic", marginTop: 2 }}>
            Tradecenter
          </h1>
<<<<<<< HEAD
=======
          <p style={{
            marginTop: 6, maxWidth: 420,
            fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.14em",
            color: "var(--text-faint)", lineHeight: 1.5,
          }}>
            EVERY STAR YOU CHART EARNS KNOWLEDGE POINTS — TRADE THEM FOR SOMETHING REAL
          </p>
>>>>>>> 706ee192ce33f62e2e5ee8edec5e22254dec73c5
        </div>
        <div style={{ position: "relative" }}>
          <RainbowHaze />
          <HudPanel style={{ padding: "10px 18px" }}>
            <MonoLabel>YOUR BALANCE</MonoLabel>
            <div style={{ fontSize: 24, color: "var(--pink-soft)", fontFamily: "var(--font-mono)" }}>
              {balance ?? "—"} KP
            </div>
            <div className="trade-refresh">
              <HudButton variant="ghost" className="arc-mini" onClick={handleRefresh} disabled={refreshing || (balance ?? 0) < REFRESH_COST_KP}>
                {refreshing ? "REFRESHING…" : `↻ REFRESH · ${REFRESH_COST_KP} KP`}
              </HudButton>
            </div>
          </HudPanel>
        </div>
      </div>

      {offline && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--pink-soft)", marginBottom: 14 }}>
          ⚠ COUPON SERVICE OFFLINE — CHECK IT'S RUNNING ON PORT 8001
        </p>
      )}

      {lastCode && (
        <HudPanel purple style={{ marginBottom: 16 }}>
          <MonoLabel style={{ color: "var(--pink-soft)" }}>REVEALED</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>{lastCode.brand} — {lastCode.title}</p>
          <div style={{
            marginTop: 6, padding: "9px 15px", display: "inline-block",
            fontFamily: "var(--font-mono)", fontSize: 17, letterSpacing: "0.08em",
            color: "var(--white-core)", background: "rgba(213,139,232,0.12)", border: "1px solid var(--pink)",
          }}>
            {lastCode.code}
          </div>
        </HudPanel>
      )}

      <div className="trade-search-row">
        <input
          className="trade-search"
          placeholder="Search by brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="trade-chips">
        <button className={`trade-chip ${kind === "all" ? "active" : ""}`} onClick={() => setKind("all")}>ALL TYPES</button>
        <button className={`trade-chip ${kind === "coupon" ? "active" : ""}`} onClick={() => setKind("coupon")}>COUPONS</button>
        <button className={`trade-chip ${kind === "voucher" ? "active" : ""}`} onClick={() => setKind("voucher")}>CASHBACK VOUCHERS</button>
        <span style={{ width: 1, background: "rgba(157,111,200,0.3)", margin: "0 2px" }} />
        <button className={`trade-chip ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>ALL CATEGORIES</button>
        {categories.map((c) => (
          <button key={c} className={`trade-chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c] ?? c.toUpperCase()}
          </button>
        ))}
        <span style={{ width: 1, background: "rgba(157,111,200,0.3)", margin: "0 2px" }} />
        <button className={`trade-chip urgent ${specialTab === "unlock" ? "active" : ""}`} onClick={() => setSpecialTab(specialTab === "unlock" ? "all" : "unlock")}>
          ◆ UNLOCK SOON
        </button>
        <button className={`trade-chip urgent ${specialTab === "expiring" ? "active" : ""}`} onClick={() => setSpecialTab(specialTab === "expiring" ? "all" : "expiring")}>
          ⏳ EXPIRING SOON
        </button>
      </div>

      {!rewards && !offline && (
        <HudPanel><SpaceLoader label="LOADING THE EXCHANGE…" /></HudPanel>
      )}

      {rewards && isFiltering && (
        <div className="trade-grid">
          {filtered.map((r) => (
            <RewardCard key={r.id} reward={r} balance={balance} now={now} onRedeem={setConfirming} />
          ))}
          {filtered.length === 0 && <MonoLabel style={{ color: "var(--text-faint)" }}>NO MATCHES</MonoLabel>}
        </div>
      )}

      {rewards && !isFiltering && (
        <>
          <div className="trade-section-label">REAL-WORLD COUPONS</div>
          <div className="trade-marquee">
            <div className="trade-marquee-track">
              {[...coupons, ...coupons].map((r, i) => (
                <RewardCard key={`${r.id}-${i}`} reward={r} balance={balance} now={now} onRedeem={setConfirming} />
              ))}
            </div>
          </div>

          <div className="trade-section-label">CASHBACK VOUCHERS</div>
          <div className="trade-marquee">
            <div className="trade-marquee-track rev">
              {[...vouchers, ...vouchers].map((r, i) => (
                <RewardCard key={`${r.id}-${i}`} reward={r} balance={balance} now={now} onRedeem={setConfirming} />
              ))}
            </div>
          </div>
        </>
      )}

<<<<<<< HEAD
      <p style={{
        textAlign: "center", marginTop: 30,
        fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.14em",
        color: "var(--text-faint)",
      }}>
        EVERY STAR YOU CHART EARNS KNOWLEDGE POINTS — TRADE THEM FOR SOMETHING REAL
      </p>

=======
>>>>>>> 706ee192ce33f62e2e5ee8edec5e22254dec73c5
      {confirming && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(4,8,20,0.7)", display: "grid", placeItems: "center", zIndex: 50 }}>
          <div style={{ width: 420, maxWidth: "90vw" }}>
            <HudPanel>
              <MonoLabel style={{ color: "var(--pink-soft)" }}>
                {confirming.kind === "voucher" ? "SCRATCH THIS CARD?" : "CONFIRM REDEMPTION"}
              </MonoLabel>
              <h2 className="display-title" style={{ fontSize: 21, fontStyle: "italic", margin: "6px 0 12px" }}>
                {confirming.brand} — {confirming.name}
              </h2>
              <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 14 }}>
                This will spend <strong style={{ color: "var(--pink-soft)" }}>{confirming.kp_cost} KP</strong>.
                Balance after: <strong>{(balance ?? 0) - confirming.kp_cost} KP</strong>.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <HudButton onClick={handleConfirm} disabled={redeeming}>
                  {redeeming ? "OPENING…" : confirming.kind === "voucher" ? "✦ SCRATCH" : "✓ CONFIRM"}
                </HudButton>
                <HudButton variant="ghost" onClick={() => setConfirming(null)} disabled={redeeming}>CANCEL</HudButton>
              </div>
            </HudPanel>
          </div>
        </div>
      )}
    </div>
  );
}
