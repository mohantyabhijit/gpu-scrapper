import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.ts";
import { marketRegistry } from "../../config/markets.ts";
import { sourceRegistry } from "../../config/sources.ts";
import { isSafeEvidenceRef } from "../evidence/reference.ts";
import type { RasterDatabase } from "./repository.ts";

export type MarketPackStatus = "pending" | "ready";

export type MarketPackInput = {
  slug: string;
  countryCode: string;
  label: string;
  currency: string;
  locale: string;
  symbol: string;
  sourceSlug: string;
  sourceDisplayName: string;
  baseUrl: string;
  catalogUrl: string;
  allowedHosts: readonly string[];
  collectorId: string;
  status?: MarketPackStatus;
  eligibilityEvidenceRef?: string;
  eligibilityVerifiedAt?: string;
  collectorCreatedEvidenceRef?: string;
  collectorCreatedAt?: string;
  collectorRunEvidenceRef?: string;
  collectorRunAt?: string;
};

export type MarketPackResult = {
  slug: string;
  countryCode: string;
  label: string;
  currency: string;
  locale: string;
  symbol: string;
  sourceSlug: string;
  status: MarketPackStatus;
};

export class MarketPackValidationError extends Error {}

type StoredMarketPackBoundary = Pick<
  MarketPackInput,
  "slug" | "countryCode" | "currency" | "sourceSlug" | "sourceDisplayName" |
  "baseUrl" | "catalogUrl" | "collectorId"
> & { allowedHosts: string; status: MarketPackStatus };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const countryPattern = /^[A-Z]{2}$/;
const currencyPattern = /^[A-Z]{3}$/;
const localePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const collectorPattern = /^c_[A-Za-z0-9_-]{2,127}$/;
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function requiredText(value: unknown, field: string, max = 256): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\r\n]/.test(value)) {
    throw new MarketPackValidationError(`${field} is invalid`);
  }
  return value.trim();
}

function dateValue(value: unknown, field: string, now: Date): string {
  const result = requiredText(value, field, 10);
  if (!datePattern.test(result)) throw new MarketPackValidationError(`${field} is invalid`);
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result || parsed > now) {
    throw new MarketPackValidationError(`${field} is invalid`);
  }
  return result;
}

function optionalText(value: unknown, field: string, max = 512): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredText(value, field, max);
}

function optionalEvidenceRef(value: unknown, field: string): string | undefined {
  const result = optionalText(value, field, 264);
  if (result !== undefined && !isSafeEvidenceRef(result)) {
    throw new MarketPackValidationError(`${field} is invalid`);
  }
  return result;
}

function httpsUrl(value: unknown, field: string): URL {
  const text = requiredText(value, field, 2048);
  let parsed: URL;
  try { parsed = new URL(text); } catch { throw new MarketPackValidationError(`${field} is invalid`); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    throw new MarketPackValidationError(`${field} is invalid`);
  }
  return parsed;
}

function normalizedHosts(value: unknown, base: URL, catalog: URL): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new MarketPackValidationError("allowedHosts is invalid");
  }
  const hosts = [...new Set(value.map((item) => requiredText(item, "allowedHosts", 253).toLowerCase()))];
  if (hosts.some((host) => !hostnamePattern.test(host) || host.includes("*") || host === "localhost")) {
    throw new MarketPackValidationError("allowedHosts is invalid");
  }
  if (!hosts.includes(base.hostname.toLowerCase()) || !hosts.some((host) => catalog.hostname === host || catalog.hostname.endsWith(`.${host}`))) {
    throw new MarketPackValidationError("allowedHosts must include the base and catalog host");
  }
  return hosts;
}

function isIsoCountryCode(value: string): boolean {
  if (!countryPattern.test(value) || value === "AA" || value === "ZZ") return false;
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" }).of(value);
    return Boolean(display && display !== value);
  } catch {
    return false;
  }
}

export function validateMarketPack(input: unknown, now = new Date()): MarketPackInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new MarketPackValidationError("request body must be an object");
  }
  const body = input as Record<string, unknown>;
  const slug = requiredText(body.slug, "slug", 64);
  if (!slugPattern.test(slug)) throw new MarketPackValidationError("slug is invalid");
  const countryCode = requiredText(body.countryCode, "countryCode", 2).toUpperCase();
  if (!isIsoCountryCode(countryCode)) throw new MarketPackValidationError("countryCode is invalid");
  if (slug in marketRegistry || Object.values(marketRegistry).some((market) => market.code === countryCode)) {
    throw new MarketPackValidationError("baseline markets cannot be replaced by a Country Pack");
  }
  const label = requiredText(body.label, "label", 80);
  const currency = requiredText(body.currency, "currency", 3).toUpperCase();
  if (!currencyPattern.test(currency) || (typeof Intl.supportedValuesOf === "function" && !Intl.supportedValuesOf("currency").includes(currency))) throw new MarketPackValidationError("currency is invalid");
  const locale = requiredText(body.locale, "locale", 32);
  try { if (!localePattern.test(locale) || new Intl.Locale(locale).language.length < 2) throw new Error(); } catch { throw new MarketPackValidationError("locale is invalid"); }
  const base = httpsUrl(body.baseUrl, "baseUrl");
  const catalog = httpsUrl(body.catalogUrl, "catalogUrl");
  if (catalog.hostname !== base.hostname) throw new MarketPackValidationError("catalogUrl must use the baseUrl host");
  const symbol = requiredText(body.symbol, "symbol", 8);
  const sourceSlug = requiredText(body.sourceSlug, "sourceSlug", 64);
  if (!slugPattern.test(sourceSlug)) throw new MarketPackValidationError("sourceSlug is invalid");
  if (sourceSlug in sourceRegistry) throw new MarketPackValidationError("baseline sources cannot be replaced by a Country Pack");
  const sourceDisplayName = requiredText(body.sourceDisplayName, "sourceDisplayName", 80);
  const allowedHosts = normalizedHosts(body.allowedHosts, base, catalog);
  const collectorId = requiredText(body.collectorId, "collectorId", 128);
  if (!collectorPattern.test(collectorId)) throw new MarketPackValidationError("collectorId is invalid");
  const status = body.status === undefined ? "pending" : requiredText(body.status, "status", 7);
  if (status !== "pending" && status !== "ready") throw new MarketPackValidationError("status is invalid");

  const eligibilityEvidenceRef = optionalEvidenceRef(body.eligibilityEvidenceRef, "eligibilityEvidenceRef");
  const eligibilityVerifiedAt = body.eligibilityVerifiedAt === undefined ? undefined : dateValue(body.eligibilityVerifiedAt, "eligibilityVerifiedAt", now);
  const collectorCreatedEvidenceRef = optionalEvidenceRef(body.collectorCreatedEvidenceRef, "collectorCreatedEvidenceRef");
  const collectorCreatedAt = body.collectorCreatedAt === undefined ? undefined : dateValue(body.collectorCreatedAt, "collectorCreatedAt", now);
  const collectorRunEvidenceRef = optionalEvidenceRef(body.collectorRunEvidenceRef, "collectorRunEvidenceRef");
  const collectorRunAt = body.collectorRunAt === undefined ? undefined : dateValue(body.collectorRunAt, "collectorRunAt", now);
  if (status === "ready" && !(eligibilityEvidenceRef && eligibilityVerifiedAt && collectorCreatedEvidenceRef && collectorCreatedAt && collectorRunEvidenceRef && collectorRunAt)) {
    throw new MarketPackValidationError("ready packs require dated eligibility, create, and run evidence");
  }
  if (status === "ready" && eligibilityVerifiedAt! > collectorCreatedAt!) {
    throw new MarketPackValidationError("eligibility evidence must predate collector creation");
  }
  if (status === "ready" && collectorCreatedAt! > collectorRunAt!) {
    throw new MarketPackValidationError("collector creation must predate the successful run");
  }

  return {
    slug, countryCode, label, currency, locale, symbol, sourceSlug, sourceDisplayName,
    baseUrl: base.toString(), catalogUrl: catalog.toString(), allowedHosts, collectorId,
    status: status as MarketPackStatus, eligibilityEvidenceRef, eligibilityVerifiedAt,
    collectorCreatedEvidenceRef, collectorCreatedAt, collectorRunEvidenceRef, collectorRunAt,
  };
}

export async function upsertMarketPack(db: RasterDatabase, input: unknown, now = new Date()): Promise<MarketPackResult> {
  const value = validateMarketPack(input, now);
  const existing = await getStoredMarketPackBoundary(db, value.slug);
  if (existing && (
    existing.sourceSlug !== value.sourceSlug
    || existing.countryCode !== value.countryCode
    || existing.currency !== value.currency
  )) {
    throw new MarketPackValidationError("country, currency, and source binding are immutable");
  }
  if (existing?.status === "ready" && (
    existing.collectorId !== value.collectorId
    || existing.baseUrl !== value.baseUrl
    || existing.catalogUrl !== value.catalogUrl
    || existing.allowedHosts !== JSON.stringify(value.allowedHosts)
    || existing.sourceDisplayName !== value.sourceDisplayName
  )) {
    throw new MarketPackValidationError("ready collector and source metadata are immutable");
  }
  const timestamp = now.toISOString();
  const serializedHosts = JSON.stringify(value.allowedHosts);
  const ready = value.status === "ready";
  const sourceValues = {
    slug: value.sourceSlug,
    displayName: value.sourceDisplayName,
    market: value.countryCode,
    region: value.countryCode,
    currency: value.currency,
    baseUrl: value.baseUrl,
    role: "secondary" as const,
    allowedHosts: serializedHosts,
    catalogUrl: value.catalogUrl,
    collectorIds: JSON.stringify({ combined: value.collectorId }),
    onboardingStatus: value.status ?? "pending",
    enabled: ready,
    updatedAt: timestamp,
  };
  await db.transaction(async (tx) => {
    // PostgreSQL enforces market_packs.source_slug as a real foreign key, so
    // create/update the source first inside the same atomic transaction.
    await tx.insert(schema.sources).values(sourceValues).onConflictDoUpdate({
      target: schema.sources.slug,
      set: sourceValues,
    });
    await tx.insert(schema.marketPacks).values({ ...value, allowedHosts: serializedHosts, updatedAt: timestamp }).onConflictDoUpdate({
      target: schema.marketPacks.slug,
      set: { ...value, allowedHosts: serializedHosts, updatedAt: timestamp },
    });
  });
  return {
    slug: value.slug,
    countryCode: value.countryCode,
    label: value.label,
    currency: value.currency,
    locale: value.locale,
    symbol: value.symbol,
    sourceSlug: value.sourceSlug,
    status: value.status ?? "pending",
  };
}

async function getStoredMarketPackBoundary(db: RasterDatabase, slug: string): Promise<StoredMarketPackBoundary | undefined> {
  const rows = await db.select({
    slug: schema.marketPacks.slug,
    countryCode: schema.marketPacks.countryCode,
    currency: schema.marketPacks.currency,
    sourceSlug: schema.marketPacks.sourceSlug,
    sourceDisplayName: schema.marketPacks.sourceDisplayName,
    baseUrl: schema.marketPacks.baseUrl,
    catalogUrl: schema.marketPacks.catalogUrl,
    allowedHosts: schema.marketPacks.allowedHosts,
    collectorId: schema.marketPacks.collectorId,
    status: schema.marketPacks.status,
  }).from(schema.marketPacks).where(eq(schema.marketPacks.slug, slug)).limit(1);
  const row = rows[0];
  return row ? { ...row, status: row.status as MarketPackStatus } : undefined;
}

export async function getMarketPack(db: RasterDatabase, slug: string): Promise<MarketPackResult | undefined> {
  const rows = await db.select({
    slug: schema.marketPacks.slug,
    countryCode: schema.marketPacks.countryCode,
    label: schema.marketPacks.label,
    currency: schema.marketPacks.currency,
    locale: schema.marketPacks.locale,
    symbol: schema.marketPacks.symbol,
    sourceSlug: schema.marketPacks.sourceSlug,
    status: schema.marketPacks.status,
  }).from(schema.marketPacks).where(eq(schema.marketPacks.slug, slug)).limit(1);
  const row = rows[0];
  return row ? { ...row, status: row.status as MarketPackStatus } : undefined;
}
