import { META_BRANDS, type MetaAccountMapping, type MetaAdsRuntimeConfig, type MetaBrand } from "@/lib/meta-ads/types";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeAccountId(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

function isBrand(value: unknown): value is MetaBrand {
  return typeof value === "string" && META_BRANDS.includes(value as MetaBrand);
}

export function parseAccountMappings(raw: string | undefined): MetaAccountMapping[] {
  if (!raw?.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("META_AD_ACCOUNT_MAPPINGS_JSON must be valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("META_AD_ACCOUNT_MAPPINGS_JSON must contain an array.");
  }

  const seen = new Set<string>();
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Meta account mapping at index ${index} must be an object.`);
    }

    const candidate = item as Record<string, unknown>;
    if (!isBrand(candidate.brand) || typeof candidate.accountId !== "string" || !candidate.accountId.trim()) {
      throw new Error(`Meta account mapping at index ${index} requires a supported brand and accountId.`);
    }

    const accountId = normalizeAccountId(candidate.accountId);
    if (seen.has(accountId)) {
      throw new Error(`Duplicate Meta account mapping: ${accountId}.`);
    }
    seen.add(accountId);

    return {
      brand: candidate.brand,
      accountId,
      ...(typeof candidate.name === "string" && candidate.name.trim() ? { name: candidate.name.trim() } : {})
    };
  });
}

export function readMetaAdsRuntimeConfig(options: { requireToken?: boolean; requireAccounts?: boolean } = {}): MetaAdsRuntimeConfig {
  const accessToken = process.env.META_ADS_ACCESS_TOKEN?.trim() ?? "";
  const accounts = parseAccountMappings(process.env.META_AD_ACCOUNT_MAPPINGS_JSON);

  if (options.requireToken !== false && !accessToken) {
    throw new Error("META_ADS_ACCESS_TOKEN is not configured.");
  }
  if (options.requireAccounts !== false && accounts.length === 0) {
    throw new Error("META_AD_ACCOUNT_MAPPINGS_JSON does not contain any account mappings.");
  }

  return {
    accessToken,
    apiVersion: process.env.META_GRAPH_API_VERSION?.trim() || "v27.0",
    accounts,
    requestTimeoutMs: positiveInteger(process.env.META_ADS_REQUEST_TIMEOUT_MS, 30_000),
    maxRetries: positiveInteger(process.env.META_ADS_MAX_RETRIES, 4),
    recentRefreshDays: positiveInteger(process.env.META_ADS_RECENT_REFRESH_DAYS, 7)
  };
}

export function metaAdsConfigurationStatus() {
  const config = readMetaAdsRuntimeConfig({ requireToken: false, requireAccounts: false });
  return {
    configured: Boolean(config.accessToken && config.accounts.length > 0),
    tokenConfigured: Boolean(config.accessToken),
    apiVersion: config.apiVersion,
    recentRefreshDays: config.recentRefreshDays,
    accounts: config.accounts.map(({ brand, accountId, name }) => ({ brand, accountId, name: name ?? null }))
  };
}
