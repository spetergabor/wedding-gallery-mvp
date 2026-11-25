import type { GraphPage } from "@/lib/meta-ads/types";

type FetchLike = typeof fetch;

export type MetaApiResponseTelemetry = {
  status: number;
  attempt: number;
  appUsage: string | null;
  adAccountUsage: string | null;
  insightsThrottle: string | null;
};

type MetaGraphClientOptions = {
  accessToken: string;
  apiVersion: string;
  requestTimeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  onResponse?: (telemetry: MetaApiResponseTelemetry) => void;
};

type GraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    is_transient?: boolean;
  };
};

export class MetaGraphError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly subcode: number | null;
  readonly isTransient: boolean;

  constructor(message: string, options: { status: number; code?: number; subcode?: number; isTransient?: boolean }) {
    super(message);
    this.name = "MetaGraphError";
    this.status = options.status;
    this.code = options.code ?? null;
    this.subcode = options.subcode ?? null;
    this.isTransient = Boolean(options.isTransient);
  }
}

export class MetaTokenExpiredError extends MetaGraphError {
  constructor(message: string, options: { status: number; subcode?: number }) {
    super(message, { ...options, code: 190, isTransient: false });
    this.name = "MetaTokenExpiredError";
  }
}

function safeGraphUrl(apiVersion: string, pathOrUrl: string, params: Record<string, string | number | boolean | undefined>) {
  const base = `https://graph.facebook.com/${apiVersion.replace(/^\/+|\/+$/g, "")}/`;
  const url = pathOrUrl.startsWith("https://")
    ? new URL(pathOrUrl)
    : new URL(pathOrUrl.replace(/^\/+/, ""), base);

  if (url.hostname !== "graph.facebook.com") {
    throw new Error("Refusing to follow a Meta pagination URL outside graph.facebook.com.");
  }

  url.searchParams.delete("access_token");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function defaultSleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class MetaGraphClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly options: MetaGraphClientOptions) {
    if (!options.accessToken) {
      throw new Error("A Meta access token is required.");
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 4;
  }

  async get<T>(pathOrUrl: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const url = safeGraphUrl(this.options.apiVersion, pathOrUrl, params);

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            authorization: `Bearer ${this.options.accessToken}`,
            accept: "application/json"
          },
          signal: controller.signal,
          cache: "no-store"
        });
        this.options.onResponse?.({
          status: response.status,
          attempt,
          appUsage: response.headers.get("x-app-usage"),
          adAccountUsage: response.headers.get("x-ad-account-usage"),
          insightsThrottle: response.headers.get("x-fb-ads-insights-throttle")
        });
        const body = (await response.json().catch(() => ({}))) as T & GraphErrorBody;

        if (response.ok && !body.error) {
          return body as T;
        }

        const graphError = body.error;
        if (graphError?.code === 190) {
          throw new MetaTokenExpiredError("The Meta access token is invalid or expired.", {
            status: response.status,
            subcode: graphError.error_subcode
          });
        }

        const retryable = response.status === 429 || response.status >= 500 || Boolean(graphError?.is_transient);
        if (!retryable || attempt === this.maxRetries) {
          throw new MetaGraphError(graphError?.message || `Meta Graph API request failed with status ${response.status}.`, {
            status: response.status,
            code: graphError?.code,
            subcode: graphError?.error_subcode,
            isTransient: retryable
          });
        }

        const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        const exponentialBackoff = 1_000 * 2 ** attempt;
        const jitter = Math.round(this.random() * 250);
        await this.sleep(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1_000 : exponentialBackoff + jitter);
      } catch (error) {
        if (error instanceof MetaTokenExpiredError || error instanceof MetaGraphError) {
          throw error;
        }
        if (attempt === this.maxRetries) {
          const message = error instanceof Error && error.name === "AbortError"
            ? "Meta Graph API request timed out."
            : "Meta Graph API request failed before a response was received.";
          throw new MetaGraphError(message, { status: 0, isTransient: true });
        }
        await this.sleep(1_000 * 2 ** attempt + Math.round(this.random() * 250));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new MetaGraphError("Meta Graph API request exhausted all retries.", { status: 0, isTransient: true });
  }

  async *paginate<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): AsyncGenerator<T[], void, void> {
    let next: string | null = path;
    let first = true;

    while (next) {
      const page: GraphPage<T> = await this.get<GraphPage<T>>(next, first ? params : {});
      yield page.data ?? [];
      next = page.paging?.next ?? null;
      first = false;
    }
  }
}
