import { and, asc, eq } from "drizzle-orm";
import * as schema from "../../db/schema.ts";
import { marketRegistry } from "../../config/markets.ts";
import { sourceRegistry, type SourceDefinition } from "../../config/sources.ts";
import { isSafeEvidenceRef } from "../evidence/reference.ts";
import type { RasterDatabase } from "./repository.ts";

export type MarketPackStatus = "pending" | "ready";
export type MarketPackEvidenceType = "eligibility" | "collector_creation" | "successful_run";
export type MarketPackInput = {
  slug: string; countryCode: string; label: string; currency: string; locale: string; symbol: string;
  sourceSlug: string; sourceDisplayName: string; baseUrl: string; catalogUrl: string;
  allowedHosts: readonly string[]; collectorId: string; status?: "pending" | "ready";
  eligibilityEvidenceRef?: string; eligibilityVerifiedAt?: string;
  collectorCreatedEvidenceRef?: string; collectorCreatedAt?: string;
  collectorRunEvidenceRef?: string; collectorRunAt?: string;
};
export type MarketPackResult = { slug: string; countryCode: string; label: string; currency: string; locale: string; symbol: string; sourceSlug: string; status: MarketPackStatus };
export type MarketPackEvidenceResult = { id: number; packSlug: string; sourceSlug: string; collectorId: string; evidenceType: MarketPackEvidenceType; verifiedAt: string };
export class MarketPackValidationError extends Error {}
export class MarketPackPromotionError extends Error {}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const countryPattern = /^[A-Z]{2}$/;
const currencyPattern = /^[A-Z]{3}$/;
const localePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const collectorPattern = /^c_[A-Za-z0-9_-]{2,127}$/;
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const hashPattern = /^[a-f0-9]{64}$/i;
const evidenceTypes = new Set<MarketPackEvidenceType>(["eligibility", "collector_creation", "successful_run"]);

function requiredText(value: unknown, field: string, max = 256): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\r\n]/.test(value)) throw new MarketPackValidationError(`${field} is invalid`);
  return value.trim();
}
function isIsoCountryCode(value: string): boolean {
  if (!countryPattern.test(value) || value === "AA" || value === "ZZ") return false;
  try { const display = new Intl.DisplayNames(["en"], { type: "region" }).of(value); return Boolean(display && display !== value); } catch { return false; }
}
function httpsUrl(value: unknown, field: string): URL {
  const text = requiredText(value, field, 2048); let parsed: URL;
  try { parsed = new URL(text); } catch { throw new MarketPackValidationError(`${field} is invalid`); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) throw new MarketPackValidationError(`${field} is invalid`);
  return parsed;
}
function normalizedHosts(value: unknown, base: URL, catalog: URL): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw new MarketPackValidationError("allowedHosts is invalid");
  const hosts = [...new Set(value.map((item) => requiredText(item, "allowedHosts", 253).toLowerCase()))];
  if (hosts.some((host) => !hostnamePattern.test(host) || host.includes("*") || host === "localhost")) throw new MarketPackValidationError("allowedHosts is invalid");
  if (!hosts.includes(base.hostname.toLowerCase()) || !hosts.some((host) => catalog.hostname === host || catalog.hostname.endsWith(`.${host}`))) throw new MarketPackValidationError("allowedHosts must include the base and catalog host");
  return hosts;
}
function rejectLegacyAdmissionClaims(body: Record<string, unknown>): void {
  if (body.status === "ready") throw new MarketPackValidationError("Country Pack admission is pending-only");
  if (body.status !== undefined && body.status !== "pending") throw new MarketPackValidationError("status is invalid");
  for (const field of ["eligibilityEvidenceRef", "eligibilityVerifiedAt", "collectorCreatedEvidenceRef", "collectorCreatedAt", "collectorRunEvidenceRef", "collectorRunAt"]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) throw new MarketPackValidationError(`${field} is server-owned evidence`);
  }
}

export function validateMarketPack(input: unknown, now = new Date()): MarketPackInput {
  void now;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new MarketPackValidationError("request body must be an object");
  const body = input as Record<string, unknown>; rejectLegacyAdmissionClaims(body);
  const slug = requiredText(body.slug, "slug", 64); if (!slugPattern.test(slug)) throw new MarketPackValidationError("slug is invalid");
  const countryCode = requiredText(body.countryCode, "countryCode", 2).toUpperCase(); if (!isIsoCountryCode(countryCode)) throw new MarketPackValidationError("countryCode is invalid");
  if (slug in marketRegistry || Object.values(marketRegistry).some((market) => market.code === countryCode)) throw new MarketPackValidationError("baseline markets cannot be replaced by a Country Pack");
  const label = requiredText(body.label, "label", 80); const currency = requiredText(body.currency, "currency", 3).toUpperCase();
  if (!currencyPattern.test(currency) || (typeof Intl.supportedValuesOf === "function" && !Intl.supportedValuesOf("currency").includes(currency))) throw new MarketPackValidationError("currency is invalid");
  const locale = requiredText(body.locale, "locale", 32); try { if (!localePattern.test(locale) || new Intl.Locale(locale).language.length < 2) throw new Error(); } catch { throw new MarketPackValidationError("locale is invalid"); }
  const base = httpsUrl(body.baseUrl, "baseUrl"); const catalog = httpsUrl(body.catalogUrl, "catalogUrl"); if (catalog.hostname !== base.hostname) throw new MarketPackValidationError("catalogUrl must use the baseUrl host");
  const symbol = requiredText(body.symbol, "symbol", 8); const sourceSlug = requiredText(body.sourceSlug, "sourceSlug", 64); if (!slugPattern.test(sourceSlug)) throw new MarketPackValidationError("sourceSlug is invalid");
  if (sourceSlug in sourceRegistry) throw new MarketPackValidationError("baseline sources cannot be replaced by a Country Pack");
  const sourceDisplayName = requiredText(body.sourceDisplayName, "sourceDisplayName", 80); const allowedHosts = normalizedHosts(body.allowedHosts, base, catalog); const collectorId = requiredText(body.collectorId, "collectorId", 128);
  if (!collectorPattern.test(collectorId)) throw new MarketPackValidationError("collectorId is invalid");
  return { slug, countryCode, label, currency, locale, symbol, sourceSlug, sourceDisplayName, baseUrl: base.toString(), catalogUrl: catalog.toString(), allowedHosts, collectorId, status: "pending" };
}

type PackBoundary = { sourceSlug: string; countryCode: string; currency: string; sourceDisplayName: string; baseUrl: string; catalogUrl: string; allowedHosts: string; collectorId: string; status: MarketPackStatus };
async function getStoredMarketPackBoundary(db: RasterDatabase, slug: string): Promise<PackBoundary | undefined> {
  const rows = await db.select({ sourceSlug: schema.marketPacks.sourceSlug, countryCode: schema.marketPacks.countryCode, currency: schema.marketPacks.currency, sourceDisplayName: schema.marketPacks.sourceDisplayName, baseUrl: schema.marketPacks.baseUrl, catalogUrl: schema.marketPacks.catalogUrl, allowedHosts: schema.marketPacks.allowedHosts, collectorId: schema.marketPacks.collectorId, status: schema.marketPacks.status }).from(schema.marketPacks).where(eq(schema.marketPacks.slug, slug)).limit(1);
  const row = rows[0]; return row ? { ...row, status: row.status as MarketPackStatus } : undefined;
}
export async function upsertMarketPack(db: RasterDatabase, input: unknown, now = new Date()): Promise<MarketPackResult> {
  void now;
  const value = validateMarketPack(input); const existing = await getStoredMarketPackBoundary(db, value.slug);
  if (existing?.status === "ready") throw new MarketPackValidationError("ready market pack boundary is immutable");
  if (existing && (existing.sourceSlug !== value.sourceSlug || existing.countryCode !== value.countryCode || existing.currency !== value.currency)) throw new MarketPackValidationError("country, currency, and source binding are immutable");
  const timestamp = new Date().toISOString(); const serializedHosts = JSON.stringify(value.allowedHosts);
  const sourceValues = { slug: value.sourceSlug, displayName: value.sourceDisplayName, market: value.countryCode, region: value.countryCode, currency: value.currency, baseUrl: value.baseUrl, role: "secondary" as const, allowedHosts: serializedHosts, catalogUrl: value.catalogUrl, collectorIds: JSON.stringify({ combined: value.collectorId }), onboardingStatus: "pending" as const, enabled: false, updatedAt: timestamp };
  await db.transaction(async (tx) => {
    await tx.insert(schema.sources).values(sourceValues).onConflictDoUpdate({ target: schema.sources.slug, set: sourceValues });
    await tx.insert(schema.marketPacks).values({ ...value, status: "pending", allowedHosts: serializedHosts, updatedAt: timestamp }).onConflictDoUpdate({ target: schema.marketPacks.slug, set: { ...value, status: "pending", allowedHosts: serializedHosts, updatedAt: timestamp } });
  });
  return { slug: value.slug, countryCode: value.countryCode, label: value.label, currency: value.currency, locale: value.locale, symbol: value.symbol, sourceSlug: value.sourceSlug, status: "pending" };
}

function dateValue(value: unknown, field: string): string {
  const result = requiredText(value, field, 30); const date = new Date(result); if (!datePattern.test(result) && Number.isNaN(date.getTime())) throw new MarketPackValidationError(`${field} is invalid`); if (Number.isNaN(date.getTime()) || date > new Date()) throw new MarketPackValidationError(`${field} is invalid`); return date.toISOString();
}
function hashValue(value: unknown): string { const result = requiredText(value, "artifactSha256", 64); if (!hashPattern.test(result)) throw new MarketPackValidationError("artifactSha256 is invalid"); return result.toLowerCase(); }
export type MarketPackEvidenceInput = { packSlug: string; sourceSlug: string; collectorId: string; evidenceType: MarketPackEvidenceType; verifiedAt: string; verificationMethod: string; artifactRef: string; artifactSha256: string; runId?: string; providerResponseId?: string };
export function validateMarketPackEvidence(input: unknown): MarketPackEvidenceInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new MarketPackValidationError("evidence body must be an object"); const body = input as Record<string, unknown>;
  const evidenceType = requiredText(body.evidenceType, "evidenceType", 32) as MarketPackEvidenceType; if (!evidenceTypes.has(evidenceType)) throw new MarketPackValidationError("evidenceType is invalid");
  const artifactRef = requiredText(body.artifactRef, "artifactRef", 264); if (!isSafeEvidenceRef(artifactRef)) throw new MarketPackValidationError("artifactRef is invalid");
  const result: MarketPackEvidenceInput = { packSlug: requiredText(body.packSlug, "packSlug", 64), sourceSlug: requiredText(body.sourceSlug, "sourceSlug", 64), collectorId: requiredText(body.collectorId, "collectorId", 128), evidenceType, verifiedAt: dateValue(body.verifiedAt, "verifiedAt"), verificationMethod: requiredText(body.verificationMethod, "verificationMethod", 80), artifactRef, artifactSha256: hashValue(body.artifactSha256) };
  if (!slugPattern.test(result.packSlug) || !slugPattern.test(result.sourceSlug) || !collectorPattern.test(result.collectorId)) throw new MarketPackValidationError("evidence identity is invalid");
  if (evidenceType === "successful_run") { result.runId = requiredText(body.runId, "runId", 200); result.providerResponseId = requiredText(body.providerResponseId, "providerResponseId", 256); } else if (body.runId !== undefined || body.providerResponseId !== undefined) throw new MarketPackValidationError("run identity is only valid for successful run evidence");
  return result;
}
export async function recordMarketPackEvidence(db: RasterDatabase, input: unknown, now = new Date()): Promise<MarketPackEvidenceResult> {
  const value = validateMarketPackEvidence(input); if (new Date(value.verifiedAt) > now) throw new MarketPackValidationError("verifiedAt is invalid");
  const packs = await db.select({ sourceSlug: schema.marketPacks.sourceSlug, collectorId: schema.marketPacks.collectorId, status: schema.marketPacks.status }).from(schema.marketPacks).where(eq(schema.marketPacks.slug, value.packSlug)).limit(1); const pack = packs[0];
  if (!pack || pack.sourceSlug !== value.sourceSlug || pack.collectorId !== value.collectorId || pack.status !== "pending") throw new MarketPackValidationError("evidence identity does not match a pending pack");
  const source = await db.select({ slug: schema.sources.slug, onboardingStatus: schema.sources.onboardingStatus, enabled: schema.sources.enabled }).from(schema.sources).where(eq(schema.sources.slug, value.sourceSlug)).limit(1); if (!source[0] || source[0].onboardingStatus !== "pending" || source[0].enabled) throw new MarketPackValidationError("evidence source is not pending");
  if (value.evidenceType === "successful_run") {
    const runs = await db.select({ runId: schema.collectorRuns.runId }).from(schema.collectorRuns).where(and(eq(schema.collectorRuns.runId, value.runId!), eq(schema.collectorRuns.sourceSlug, value.sourceSlug), eq(schema.collectorRuns.collectorId, value.collectorId), eq(schema.collectorRuns.responseId, value.providerResponseId!), eq(schema.collectorRuns.status, "healthy"))).limit(1);
    if (!runs[0]) throw new MarketPackValidationError("successful run evidence requires a persisted healthy run");
    const [run] = await db.select({ acceptedCount: schema.collectorRuns.acceptedCount }).from(schema.collectorRuns).where(eq(schema.collectorRuns.runId, value.runId!)).limit(1);
    if (!run || run.acceptedCount <= 0) throw new MarketPackValidationError("successful run evidence requires non-empty output");
  }
  const [row] = await db.insert(schema.marketPackEvidence).values({ packSlug: value.packSlug, sourceSlug: value.sourceSlug, collectorId: value.collectorId, evidenceType: value.evidenceType, verifiedAt: value.verifiedAt, verificationMethod: value.verificationMethod, verificationStatus: "verified", artifactRef: value.artifactRef, artifactSha256: value.artifactSha256, runId: value.runId, providerResponseId: value.providerResponseId }).returning({ id: schema.marketPackEvidence.id });
  if (!row) throw new MarketPackValidationError("evidence was not recorded"); return { id: row.id, packSlug: value.packSlug, sourceSlug: value.sourceSlug, collectorId: value.collectorId, evidenceType: value.evidenceType, verifiedAt: value.verifiedAt };
}
export async function promoteMarketPack(db: RasterDatabase, slug: string): Promise<MarketPackResult> {
  if (!slugPattern.test(slug)) throw new MarketPackPromotionError("pack slug is invalid");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(schema.marketPacks).where(eq(schema.marketPacks.slug, slug)).limit(1).for("update"); const pack = rows[0]; if (!pack || pack.status !== "pending") throw new MarketPackPromotionError("pack is not pending");
    const evidence = await tx.select().from(schema.marketPackEvidence).where(and(eq(schema.marketPackEvidence.packSlug, pack.slug), eq(schema.marketPackEvidence.sourceSlug, pack.sourceSlug), eq(schema.marketPackEvidence.collectorId, pack.collectorId))).orderBy(asc(schema.marketPackEvidence.verifiedAt)); const byType = new Map(evidence.map((row) => [row.evidenceType, row]));
    const eligibility = byType.get("eligibility"); const creation = byType.get("collector_creation"); const runProof = byType.get("successful_run"); if (!eligibility || !creation || !runProof || !(eligibility.verifiedAt <= creation.verifiedAt && creation.verifiedAt <= runProof.verifiedAt) || [eligibility, creation, runProof].some((row) => !hashPattern.test(row.artifactSha256))) throw new MarketPackPromotionError("all ordered evidence with artifact hashes is required");
    const runs = await tx.select().from(schema.collectorRuns).where(and(eq(schema.collectorRuns.runId, runProof.runId!), eq(schema.collectorRuns.sourceSlug, pack.sourceSlug), eq(schema.collectorRuns.collectorId, pack.collectorId), eq(schema.collectorRuns.responseId, runProof.providerResponseId!))).limit(1); const run = runs[0]; if (!run || run.status !== "healthy" || run.acceptedCount <= 0 || !run.responseId) throw new MarketPackPromotionError("successful non-empty collector run is required");
    const timestamp = new Date().toISOString(); await tx.update(schema.marketPacks).set({ status: "ready", updatedAt: timestamp }).where(eq(schema.marketPacks.slug, slug)); await tx.update(schema.sources).set({ onboardingStatus: "ready", enabled: true, updatedAt: timestamp }).where(eq(schema.sources.slug, pack.sourceSlug));
    return { slug: pack.slug, countryCode: pack.countryCode, label: pack.label, currency: pack.currency, locale: pack.locale, symbol: pack.symbol, sourceSlug: pack.sourceSlug, status: "ready" };
  });
}
export async function getMarketPack(db: RasterDatabase, slug: string): Promise<MarketPackResult | undefined> {
  const rows = await db.select({ slug: schema.marketPacks.slug, countryCode: schema.marketPacks.countryCode, label: schema.marketPacks.label, currency: schema.marketPacks.currency, locale: schema.marketPacks.locale, symbol: schema.marketPacks.symbol, sourceSlug: schema.marketPacks.sourceSlug, status: schema.marketPacks.status }).from(schema.marketPacks).where(eq(schema.marketPacks.slug, slug)).limit(1); const row = rows[0]; return row ? { ...row, status: row.status as MarketPackStatus } : undefined;
}
/** Narrow server-only path used by onboarding operators; never used by catalog resolution. */
export async function resolvePendingMarketPack(db: RasterDatabase, slug: string): Promise<SourceDefinition | undefined> {
  const rows = await db.select().from(schema.marketPacks).where(eq(schema.marketPacks.slug, slug)).limit(1); const pack = rows[0]; if (!pack || pack.status !== "pending") return undefined;
  let allowedHosts: string[]; try { const parsed = JSON.parse(pack.allowedHosts); if (!Array.isArray(parsed) || parsed.some((host) => typeof host !== "string")) return undefined; allowedHosts = parsed; } catch { return undefined; }
  return { slug: pack.sourceSlug, displayName: pack.sourceDisplayName, role: "secondary", region: pack.countryCode, currency: pack.currency, baseUrl: pack.baseUrl, catalogUrl: pack.catalogUrl, allowedHosts, enabled: false, collectorIds: { combined: pack.collectorId as `c_${string}` }, collectorRoles: ["combined"] };
}
