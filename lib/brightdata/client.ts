import type { CollectorRole, SourceDefinition, SourceSlug } from "../../config/sources.ts";

export const BRIGHTDATA_API_BASE = "https://api.brightdata.com";
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_POLL_INTERVAL_MS = 5_000;
export const DEFAULT_MAX_POLL_ATTEMPTS = 72;
export const MAX_TIMEOUT_MS = 30_000;
export const MAX_POLL_INTERVAL_MS = 5_000;
export const MAX_POLL_ATTEMPTS = 90;
export const MAX_RESPONSE_ID_LENGTH = 256;
// Keep provider work to 6m15s, leaving the signed refresh workflow's 60s margin.
// This is an elapsed-time deadline, not a request-count calculation.
export const MAX_PROVIDER_RUN_MS = 375_000;

export type BrightDataClientOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  overallTimeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
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
  /** Safe provider identity, when trigger succeeded before the failure. */
  readonly responseId?: string;

  constructor(
    code: BrightDataErrorCode,
    message: string,
    status?: number,
    responseId?: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.responseId = responseId;
    this.name = "BrightDataError";
  }
}

function responseIdFrom(payload: unknown): string | undefined {
  if (typeof payload === "string" && payload.trim().length <= MAX_RESPONSE_ID_LENGTH) return payload.trim() || undefined;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of ["collection_id", "response_id", "responseId", "snapshot_id", "snapshotId", "id"]) {
    if (typeof record[key] === "string" && record[key].trim() && record[key].trim().length <= MAX_RESPONSE_ID_LENGTH) return record[key].trim();
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
  const overallTimeoutMs = Math.min(Math.max(Number(options.overallTimeoutMs) || MAX_PROVIDER_RUN_MS, 1_000), MAX_PROVIDER_RUN_MS);
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;

  if (!apiKey) throw new BrightDataError("not_configured", "Bright Data is not configured");

  async function request(
    path: string,
    init: RequestInit,
    deadlineAt?: number,
    responseId?: string,
  ): Promise<{ response: Response; payload: unknown }> {
    const remainingMs = deadlineAt === undefined ? undefined : deadlineAt - now();
    if (remainingMs !== undefined && remainingMs <= 0) {
      throw new BrightDataError("timeout", "Bright Data provider run deadline exceeded", undefined, responseId);
    }
    const requestTimeoutMs = remainingMs === undefined ? timeoutMs : Math.min(timeoutMs, Math.max(remainingMs, 1));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
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
        throw new BrightDataError("timeout", "Bright Data request timed out", undefined, responseId);
      }
      throw new BrightDataError("provider_error", "Bright Data request could not be completed", undefined, responseId);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function triggerAndPoll(trigger: BrightDataTrigger): Promise<BrightDataRun> {
    const deadlineAt = now() + overallTimeoutMs;
    const started = await request(`/dca/trigger?collector=${encodeURIComponent(trigger.collectorId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ url: trigger.inputUrl }]),
    }, deadlineAt);
    const responseId = responseIdFrom(started.payload);
    if (!responseId) throw new BrightDataError("invalid_response", "Bright Data returned no response id");
    if (now() >= deadlineAt) {
      throw new BrightDataError("timeout", "Bright Data provider run deadline exceeded", undefined, responseId);
    }

    for (let attempt = 1; attempt <= maxPollAttempts; attempt += 1) {
      if (attempt > 1) {
        const remainingMs = deadlineAt - now();
        if (remainingMs <= 0) {
          throw new BrightDataError("timeout", "Bright Data provider run deadline exceeded", undefined, responseId);
        }
        await sleep(Math.min(pollIntervalMs, remainingMs));
        if (now() >= deadlineAt) {
          throw new BrightDataError("timeout", "Bright Data provider run deadline exceeded", undefined, responseId);
        }
      }
      let polled: { response: Response; payload: unknown };
      try {
        polled = await request(`/dca/dataset?id=${encodeURIComponent(responseId)}`, { method: "GET" }, deadlineAt, responseId);
      } catch (error) {
        if (error instanceof BrightDataError) {
          throw new BrightDataError(error.code, error.message, error.status, responseId);
        }
        throw new BrightDataError("provider_error", "Bright Data dataset could not be completed", undefined, responseId);
      }
      const rows = rowsFrom(polled.payload);
      if (rows) return { sourceSlug: trigger.sourceSlug, collectorId: trigger.collectorId, responseId, rows, attempts: attempt };
      if (!isPending(polled.payload, polled.response)) {
        throw new BrightDataError("invalid_response", "Bright Data returned an unusable dataset response", undefined, responseId);
      }
    }
    throw new BrightDataError("timeout", "Bright Data dataset did not complete within the polling limit", undefined, responseId);
  }

  return { triggerAndPoll };
}

export function collectorForSource(source: SourceDefinition, role: CollectorRole = "combined"): string | undefined {
  return source.collectorIds[role];
}
