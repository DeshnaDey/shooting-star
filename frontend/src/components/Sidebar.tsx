import { useLocation, useNavigate } from "react-router-dom";

const ITEMS = [
  {
    to: "/", label: "CONSTELLATION",
    match: (p: string) => p === "/" || p.startsWith("/system"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="4" cy="13" r="1.6" fill="currentColor" />
        <circle cx="9" cy="5" r="1.6" fill="currentColor" />
        <circle cx="14.5" cy="11" r="1.6" fill="currentColor" />
        <path d="M4 13 L9 5 L14.5 11" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
      </svg>
    ),
  },
  {
    to: "/arcade", label: "ARCADE",
    match: (p: string) => p.includes("/arcade"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="6" width="14" height="8.5" rx="3" stroke="currentColor" strokeWidth="1.1" />
        <path d="M5 10 H7 M6 9 V11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="11.5" cy="9.4" r="0.9" fill="currentColor" />
        <circle cx="13" cy="11" r="0.9" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: "/trade", label: "TRADECENTER",
    match: (p: string) => p.startsWith("/trade"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 6.5 H13 M10.5 3.5 L13.5 6.5 L10.5 9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 11.5 H5 M7.5 8.5 L4.5 11.5 L7.5 14.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/profile", label: "PROFILE",
    match: (p: string) => p.startsWith("/profile"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.1" />
        <path d="M3.5 15 C3.5 11.8 6 10.5 9 10.5 C12 10.5 14.5 11.8 14.5 15" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="side-rail">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <button
            key={item.to}
            className={`side-item ${active ? "active" : ""}`}
            onClick={() => navigate(item.to)}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
