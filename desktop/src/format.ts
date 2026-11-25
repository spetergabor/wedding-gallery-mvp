import type { Brand } from "./types";

export function currencyFor(brand: Brand, backendCurrency?: string | null) {
  return backendCurrency || (brand === "IRISMOMENT" ? "HUF" : "EUR");
}

export function money(value: number | null | undefined, currency: string) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "HUF" ? 0 : 2
  }).format(value);
}

export function number(value: number | null | undefined, maximumFractionDigits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits }).format(value);
}

export function percent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(value)}%`;
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function shortDate(value: string) {
  return new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric" }).format(new Date(value));
}

export function statusLabel(value: string | null | undefined) {
  const normalized = (value || "unknown").toUpperCase();
  const labels: Record<string, string> = {
    ACTIVE: "Aktív",
    COMPLETED: "Befejezett",
    PAUSED: "Szüneteltetett",
    ARCHIVED: "Befejezett",
    DELETED: "Törölt",
    CAMPAIGN_PAUSED: "Kampány szünetel",
    ADSET_PAUSED: "Hirdetéssorozat szünetel",
    WITH_ISSUES: "Problémás",
    UNKNOWN: "Ismeretlen"
  };
  return labels[normalized] || normalized.replaceAll("_", " ").toLowerCase();
}

export function placementLabel(platform: string, position: string) {
  const publisher = platform.toLowerCase() === "instagram" ? "Instagram" : platform.toLowerCase() === "facebook" ? "Facebook" : platform;
  const positions: Record<string, string> = {
    feed: "Feed",
    story: "Stories",
    stories: "Stories",
    reels: "Reels",
    instagram_reels: "Reels",
    facebook_reels: "Reels"
  };
  return `${publisher} ${positions[position.toLowerCase()] || position.replaceAll("_", " ")}`;
}
