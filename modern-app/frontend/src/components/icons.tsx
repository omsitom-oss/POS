import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "sales"
  | "purchases"
  | "inventory"
  | "items"
  | "customers"
  | "suppliers"
  | "settings"
  | "reports"
  | "users"
  | "design"
  | "currency"
  | "info"
  | "ruler"
  | "image"
  | "sun"
  | "moon"
  | "view"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "plus"
  | "more"
  | "globe"
  | "city"
  | "search"
  | "edit"
  | "disable"
  | "enable"
  | "history"
  | "key"
  | "wallet"
  | "bank"
  | "swap"
  | "arrow-right"
  | "document"
  | "logout"
  | "calculator"
  | "coins"
  | "sum"
  | "barcode"
  | "menu"
  | "trash"
  | "user"
  | "lock"
  | "save"
  | "close"
  | "arrow-left";

export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<IconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    sales: (
      <>
        <path d="M4 6h16l-1.5 10H6L4 6Z" />
        <path d="M4 6 3 3H1" />
        <circle cx="8" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
      </>
    ),
    purchases: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <path d="m7 4-3 3 3 3M17 14l3 3-3 3" />
      </>
    ),
    inventory: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="M4 7.5 12 12l8-4.5M12 12v9" />
      </>
    ),
    items: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7M12 11v10" />
      </>
    ),
    customers: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    suppliers: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="17" cy="19" r="2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.6h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.6h-.2a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    reports: (
      <>
        <path d="M5 20V10M12 20V4M19 20v-7" />
        <path d="M3 20h18" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 8h18M16 13h3" />
        <circle cx="16" cy="13" r=".8" fill="currentColor" stroke="none" />
      </>
    ),
    bank: (
      <>
        <path d="m3 9 9-5 9 5M5 10v7m4-7v7m6-7v7m4-7v7M3 20h18" />
        <path d="M2 9h20" />
      </>
    ),
    swap: (
      <>
        <path d="M7 7h12l-3-3m3 3-3 3M17 17H5l3 3m-3-3 3-3" />
      </>
    ),
    "arrow-right": (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    logout: (
      <>
        <path d="M14 5V3H5v18h9v-2" />
        <path d="M10 12h10m-4-4 4 4-4 4" />
      </>
    ),
    document: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5M9 13h6m-6 4h6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6M12 7.5h.01" />
      </>
    ),
    ruler: (
      <>
        <path d="M4 18 18 4l2 2L6 20H4v-2Z" />
        <path d="m9 15 2 2m1-6 2 2m1-6 2 2" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m5 17 4.5-4 3 2.5 2.5-2 4 3.5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" />
      </>
    ),
    design: (
      <>
        <path d="m4 17 13-13 3 3L7 20l-4 1 1-4Z" />
        <path d="m13 7 3 3" />
      </>
    ),
    currency: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 8.5c-.7-.6-1.6-1-2.8-1-1.8 0-3.2.9-3.2 2.2s1.2 2 3.1 2.3c1.9.3 3.1 1 3.1 2.3s-1.4 2.2-3.2 2.2c-1.2 0-2.2-.4-2.9-1" />
        <path d="M12 6v12" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: (
      <path d="M20.1 15.4A8.8 8.8 0 0 1 8.6 3.9 8.9 8.9 0 1 0 20.1 15.4Z" />
    ),
    "chevron-left": <path d="m14 5-7 7 7 7" />,
    "chevron-right": <path d="m10 5 7 7-7 7" />,
    "chevron-down": <path d="m5 9 7 7 7-7" />,
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
    view: (
      <>
        <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    city: (
      <>
        <path d="M5 21V6l7-3v18M12 21h7V10l-7-2" />
        <path d="M8 9h1m-1 4h1m-1 4h1m7-4h1m-1 4h1" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    edit: (
      <>
        <path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" />
      </>
    ),
    disable: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m6 6 12 12" />
      </>
    ),
    enable: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5M12 7v5l3 2" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 9-9m-3 3 2 2m-5-1 2 2" />
      </>
    ),
    calculator: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8M8 12h.01m4 0h.01m4 0h.01M8 16h.01m4 0h.01m4 0h.01" />
      </>
    ),
    coins: (
      <>
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </>
    ),
    sum: (
      <>
        <path d="M6 4h13M6 20h13M7 4l8 8-8 8" />
      </>
    ),
    barcode: (
      <>
        <path d="M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14" />
      </>
    ),
    menu: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 4v16" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    save: (
      <>
        <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3Z" />
        <path d="M8 3v5h7V3M8 21v-7h8v7" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12M18 6 6 18" />
      </>
    ),
    "arrow-left": (
      <>
        <path d="M20 12H4m6-6-6 6 6 6" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      {...common}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
