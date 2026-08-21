import type { CollectorRole, SourceDefinition, SourceSlug } from "../../config/sources.ts";

export const BRIGHTDATA_API_BASE = "https://api.brightdata.com";
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_POLL_INTERVAL_MS = 1_000;
export const DEFAULT_MAX_POLL_ATTEMPTS = 5;
export const MAX_TIMEOUT_MS = 30_000;
export const MAX_POLL_INTERVAL_MS = 5_000;
export const MAX_POLL_ATTEMPTS = 10;

export type BrightDataClientOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type BrightDataTrigger = {
  sourceSlug: SourceSlug;
  collectorId: string;
  inputUrl: string;
};

export type BrightDataRun = {
  sourceSlug: SourceSlug;
  collectorId: string;
  responseId: string;
  rows: unknown[];
  attempts: number;
};

export type BrightDataErrorCode = "not_configured" | "invalid_response" | "provider_error" | "timeout";

export class BrightDataError extends Error {
  readonly code: BrightDataErrorCode;
  readonly status?: number;

  constructor(
    code: BrightDataErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "BrightDataError";
  }
}

function responseIdFrom(payload: unknown): string | undefined {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of ["collection_id", "response_id", "responseId", "snapshot_id", "snapshotId", "id"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return undefined;
}

function rowsFrom(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of ["data", "results", "rows", "items"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return undefined;
}

function isPending(payload: unknown, response: Response): boolean {
  if (response.status === 202 || response.status === 404) return true;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const status = (payload as Record<string, unknown>).status;
  return typeof status === "string" && ["pending", "running", "processing", "queued"].includes(status.toLowerCase());
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function createBrightDataClient(options: BrightDataClientOptions = {}) {
  const apiKey = options.apiKey?.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? BRIGHTDATA_API_BASE;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 100), MAX_TIMEOUT_MS);
  const pollIntervalMs = Math.min(Math.max(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS, 0), MAX_POLL_INTERVAL_MS);
  const maxPollAttempts = Math.min(Math.max(Math.floor(options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS), 1), MAX_POLL_ATTEMPTS);
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  if (!apiKey) throw new BrightDataError("not_configured", "Bright Data is not configured");

  async function request(path: string, init: RequestInit): Promise<{ response: Response; payload: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(init.headers ?? {}),
        },
      });
      const payload = await readJson(response);
      if (!response.ok && response.status !== 202 && response.status !== 404) {
        throw new BrightDataError("provider_error", `Bright Data request failed (${response.status})`, response.status);
      }
      return { response, payload };
    } catch (error) {
      if (error instanceof BrightDataError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new BrightDataError("timeout", "Bright Data request timed out");
      }
      throw new BrightDataError("provider_error", "Bright Data request could not be completed");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function triggerAndPoll(trigger: BrightDataTrigger): Promise<BrightDataRun> {
    const started = await request(`/dca/trigger?collector=${encodeURIComponent(trigger.collectorId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ url: trigger.inputUrl }]),
    });
    const responseId = responseIdFrom(started.payload);
    if (!responseId) throw new BrightDataError("invalid_response", "Bright Data returned no response id");

    for (let attempt = 1; attempt <= maxPollAttempts; attempt += 1) {
      if (attempt > 1) await sleep(pollIntervalMs);
      const polled = await request(`/dca/dataset?id=${encodeURIComponent(responseId)}`, { method: "GET" });
      const rows = rowsFrom(polled.payload);
      if (rows) return { sourceSlug: trigger.sourceSlug, collectorId: trigger.collectorId, responseId, rows, attempts: attempt };
      if (!isPending(polled.payload, polled.response)) {
        throw new BrightDataError("invalid_response", "Bright Data returned an unusable dataset response");
      }
    }
    throw new BrightDataError("timeout", "Bright Data dataset did not complete within the polling limit");
  }

  return { triggerAndPoll };
}

export function collectorForSource(source: SourceDefinition, role: CollectorRole = "combined"): string | undefined {
  return source.collectorIds[role];
}
