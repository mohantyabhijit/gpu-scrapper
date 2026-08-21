import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { getSource, sourceHostIsAllowedForDefinition, type SourceDefinition } from "../../config/sources.ts";
import { validateRawOffer, type RawOffer, type ValidationCode } from "../../scrapers/contracts.ts";

export const HEALING_HARNESS_SCHEMA_VERSION = 1;
export const HEALING_REQUIRED_FIELDS = [
  "title",
  "product_url",
  "price",
  "currency",
  "availability",
  "market",
] as const;

export type HealingRequiredField = (typeof HEALING_REQUIRED_FIELDS)[number];

export type HealingManifest = {
  sourceSlug: string;
  collectorId: string;
  inputUrl: string;
  requiredField: HealingRequiredField;
};

export type ArtifactHash = {
  path: string;
  sha256: string;
};

export type DownstreamFileHash = ArtifactHash & {
  beforeSha256?: string;
  afterSha256?: string;
};

export type HealingBaseline = {
  schema_version: typeof HEALING_HARNESS_SCHEMA_VERSION;
  evidence_type: "healing-baseline";
  source_slug: string;
  collector_id: string;
  input_url: string;
  required_field: HealingRequiredField;
  before_artifact: ArtifactHash;
  downstream_files: readonly ArtifactHash[];
};

/** Every code path whose contract must remain unchanged during a heal proof. */
export const REQUIRED_DOWNSTREAM_PATHS = [
  "config/sources.ts",
  "lib/brightdata/refresh.ts",
  "app/api/refresh/route.ts",
  "lib/ingest.ts",
  "lib/d1/repository.ts",
  "app/page.tsx",
] as const;

export type HealingProof = {
  schema_version: typeof HEALING_HARNESS_SCHEMA_VERSION;
  evidence_type: "healing-proof";
  status: "passed";
  source_slug: string;
  collector_id: string;
  input_url: string;
  required_field: HealingRequiredField;
  before: ArtifactHash & { rows: number; contract: "failed" };
  preview: ArtifactHash & { status: "previewed" };
  after: ArtifactHash & { rows: number; valid_rows: number; contract: "passed" };
  downstream: {
    unchanged: true;
    files: readonly DownstreamFileHash[];
  };
};

export class HealingHarnessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HealingHarnessError";
  }
}

const collectorIdPattern = /^c_[A-Za-z0-9_-]{2,127}$/;
const sensitiveKeyPattern = /(access[_-]?token|api[_-]?key|authorization|bearer|client[_-]?secret|cookie|credential|password|private[_-]?key|provider[_-]?(body|error|response)|raw[_-]?(body|error|response)|refresh[_-]?token|secret|set[_-]?cookie|token|(?:^|_)(?:error|headers?|body|stack)(?:$|_))/i;
const sensitiveValuePatterns = [
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
  /\bbearer\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|refresh[_-]?token|secret)\s*[:=]/i,
  /[?&](?:access[_-]?token|api[_-]?key|signature|token)=/i,
];
const artifactMaxBytes = 8 * 1024 * 1024;
const successfulCaptureStatuses = new Set(["completed", "success", "succeeded"]);
const positivePreviewStatuses = new Set(["awaiting_approval", "preview_ready", "approved", "approval_granted", "healed_preview"]);
const responseIdentityKeys = ["response_id", "responseId", "run_id", "runId"] as const;

function fail(message: string): never {
  throw new HealingHarnessError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertNoSensitiveMaterial(value: unknown, location = "$", depth = 0): void {
  if (depth > 12) fail("provider artifact nesting exceeds the safety limit");
  if (typeof value === "string") {
    if (sensitiveValuePatterns.some((pattern) => pattern.test(value))) {
      fail("provider artifact contains prohibited credential material");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveMaterial(item, `${location}[${index}]`, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) fail("provider artifact contains a prohibited field");
    assertNoSensitiveMaterial(child, `${location}.${key}`, depth + 1);
  }
}

function relativeSafePath(root: string, requested: string): string {
  if (!requested || path.isAbsolute(requested)) fail("artifact and consumer paths must be repository-relative");
  if (requested.split(/[\\/]/).some((segment) => segment === "..")) fail("artifact and consumer paths may not use lexical traversal");
  const normalized = path.normalize(requested);
  if (normalized === "." || normalized.startsWith(`..${path.sep}`) || normalized === "..") {
    fail("artifact and consumer paths must remain inside the repository");
  }
  if (/(^|[\\/])(?:\.env|.*(?:secret|credential|password|private[-_]?key|token).*)$/i.test(normalized)) {
    fail("artifact and consumer paths may not name secret material");
  }
  return normalized;
}

async function realPathInside(root: string, requested: string): Promise<{ absolute: string; relative: string }> {
  const relative = relativeSafePath(root, requested);
  const realRoot = await pathRealpath(root);
  const absolute = await pathRealpath(path.join(realRoot, relative));
  const rootPrefix = `${realRoot}${path.sep}`;
  if (absolute !== realRoot && !absolute.startsWith(rootPrefix)) fail("path resolves outside the repository");
  return { absolute, relative: path.relative(realRoot, absolute) };
}

async function pathRealpath(value: string): Promise<string> {
  try {
    return await realpath(value);
  } catch {
    fail("path does not exist");
  }
}

/** Resolve a CLI output path without allowing symlink or secret-path escapes. */
export async function resolveSafeOutputPath(root: string, requested: string): Promise<string> {
  const relative = relativeSafePath(root, requested);
  const realRoot = await pathRealpath(root);
  const absolute = path.resolve(realRoot, relative);
  const rootPrefix = `${realRoot}${path.sep}`;
  if (!absolute.startsWith(rootPrefix)) fail("output must stay inside the repository");
  const parent = path.dirname(absolute);
  const realParent = await pathRealpath(parent);
  if (!realParent.startsWith(rootPrefix)) fail("output parent resolves outside the repository");
  try {
    const stats = await lstat(absolute);
    if (!stats.isFile()) fail("output must be a regular file, not a symlink or directory");
    const resolved = await pathRealpath(absolute);
    if (!resolved.startsWith(rootPrefix)) fail("output resolves outside the repository");
  } catch (error) {
    if (error instanceof HealingHarnessError) throw error;
    // A new regular file is safe once its real parent has been checked.
  }
  return absolute;
}

async function readJsonArtifact(root: string, requested: string): Promise<{ hash: ArtifactHash; value: unknown }> {
  const resolved = await realPathInside(root, requested);
  const stats = await lstat(resolved.absolute);
  if (!stats.isFile() || stats.size > artifactMaxBytes) fail("provider artifact must be a regular JSON file under 8 MiB");
  let bytes: Uint8Array;
  try {
    bytes = await readFile(resolved.absolute);
  } catch {
    fail("provider artifact is not readable");
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail("provider artifact must contain valid JSON");
  }
  assertNoSensitiveMaterial(value);
  return {
    hash: { path: resolved.relative, sha256: createHash("sha256").update(bytes).digest("hex") },
    value,
  };
}

async function hashRepositoryFile(root: string, requested: string): Promise<ArtifactHash> {
  const resolved = await realPathInside(root, requested);
  const stats = await lstat(resolved.absolute);
  if (!stats.isFile()) fail("downstream consumer paths must name regular files");
  const bytes = await readFile(resolved.absolute);
  return { path: resolved.relative, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function manifestSource(manifest: HealingManifest): SourceDefinition {
  if (!collectorIdPattern.test(manifest.collectorId)) fail("collectorId must be an exact c_* identifier");
  if (!HEALING_REQUIRED_FIELDS.includes(manifest.requiredField)) fail("requiredField is not supported");
  let source: SourceDefinition;
  try {
    source = getSource(manifest.sourceSlug);
  } catch {
    fail("sourceSlug is not in the source registry");
  }
  if (!source.enabled) fail("source is not enabled in the source registry");
  if (!Object.values(source.collectorIds).some((collectorId) => collectorId === manifest.collectorId)) {
    fail("Collector ID is not configured for the enabled source");
  }
  let parsed: URL;
  try {
    parsed = new URL(manifest.inputUrl);
  } catch {
    fail("inputUrl must be a valid URL");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) fail("inputUrl must be a public HTTPS URL");
  if (!sourceHostIsAllowedForDefinition(source, manifest.inputUrl)) fail("inputUrl is outside the source allowlist");
  return source;
}

function topLevelText(value: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  return undefined;
}

function assertCaptureEnvelope(value: unknown, manifest: HealingManifest, source: SourceDefinition, phase: "before" | "preview" | "after"): Record<string, unknown> {
  if (!isObject(value)) fail("provider artifact must be a capture envelope object, not a root JSON array or scalar");
  const collectorId = value.collector_id;
  if (typeof collectorId !== "string" || collectorId !== manifest.collectorId) fail("provider artifact must contain exactly the expected Collector ID");
  if (typeof value.source_slug !== "string" || value.source_slug !== manifest.sourceSlug) fail("provider artifact source does not match the fixed source");
  if (typeof value.input_url !== "string" || value.input_url !== manifest.inputUrl) fail("provider artifact input does not match the fixed input URL");
  if (typeof value.status !== "string" || !value.status.trim()) fail("provider artifact must contain a top-level status");
  if (!Array.isArray(value.rows)) fail("provider artifact must contain a top-level rows array");
  if (phase === "preview") {
    const status = value.status.trim().toLowerCase().replace(/[ -]+/g, "_");
    if (!positivePreviewStatuses.has(status)) fail("preview artifact lacks an exact positive top-level preview status");
  } else {
    const status = value.status.trim().toLowerCase().replace(/[ -]+/g, "_");
    if (!successfulCaptureStatuses.has(status)) fail("provider artifact must contain an exact successful/completed top-level status");
    const identity = topLevelText(value, responseIdentityKeys);
    if (!identity) fail("provider artifact must contain a non-secret response/run identity before rows");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(identity)) fail("provider response/run identity is invalid");
  }
  if (!source) fail("source definition is unavailable");
  return value;
}

function requiredValuePresent(row: Record<string, unknown>, field: HealingRequiredField): boolean {
  const aliases: Record<HealingRequiredField, readonly string[]> = {
    title: ["title"],
    product_url: ["product_url", "url"],
    price: ["price", "price_minor"],
    currency: ["currency"],
    availability: ["availability", "stock"],
    market: ["market"],
  };
  return aliases[field].some((key) => {
    const value = row[key];
    return value !== undefined && value !== null && value !== "";
  });
}

const requiredError: Record<HealingRequiredField, ValidationCode> = {
  title: "title_required",
  product_url: "url_required",
  price: "price_required",
  currency: "currency_invalid",
  availability: "availability_invalid",
  market: "market_invalid",
};

function rowsIn(value: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(value.rows)) fail("provider artifact must contain a top-level rows array");
  return value.rows.map((row, index) => {
    if (!isObject(row)) fail(`provider artifact row ${index} must be an object; null, scalar, and nested arrays are invalid`);
    return row;
  });
}

function assertBrokenBefore(value: Record<string, unknown>, manifest: HealingManifest, source: SourceDefinition): number {
  const rows = rowsIn(value);
  if (rows.length === 0) fail("provider artifact contains no object rows");
  const results = rows.map((row) => validateRawOffer(row as RawOffer, manifest.sourceSlug, source));
  if (results.some((result) => result.ok)) fail("before artifact unexpectedly contains a valid contract row");
  const expected = requiredError[manifest.requiredField];
  if (!rows.some((row, index) => !requiredValuePresent(row, manifest.requiredField) && !results[index].ok && results[index].errors.includes(expected))) {
    fail("before artifact does not prove the selected required field failed");
  }
  return rows.length;
}

function assertPreview(value: Record<string, unknown>, manifest: HealingManifest): void {
  if (!positivePreviewStatuses.has(String(value.status).trim().toLowerCase().replace(/[ -]+/g, "_"))) fail("preview artifact lacks an exact positive top-level preview status");
  if (manifest.requiredField.length === 0) fail("requiredField is invalid");
}

function assertRecoveredAfter(value: Record<string, unknown>, manifest: HealingManifest, source: SourceDefinition): { rows: number; validRows: number } {
  const rows = rowsIn(value);
  if (rows.length === 0) fail("after artifact contains no recovered rows");
  const results = rows.map((row) => validateRawOffer(row as RawOffer, manifest.sourceSlug, source));
  const validRows = results.filter((result) => result.ok).length;
  if (validRows !== rows.length) fail("after artifact does not pass the complete shared contract");
  if (rows.some((row) => !requiredValuePresent(row, manifest.requiredField))) fail("after artifact still lacks the required field");
  return { rows: rows.length, validRows };
}

function manifestFromBaseline(baseline: HealingBaseline): HealingManifest {
  if (!baseline || baseline.schema_version !== HEALING_HARNESS_SCHEMA_VERSION || baseline.evidence_type !== "healing-baseline") fail("baseline has an unsupported schema");
  return {
    sourceSlug: baseline.source_slug,
    collectorId: baseline.collector_id,
    inputUrl: baseline.input_url,
    requiredField: baseline.required_field,
  };
}

export async function createHealingBaseline(options: HealingManifest & { repoRoot: string; beforePath: string; downstreamPaths: readonly string[] }): Promise<HealingBaseline> {
  const manifest: HealingManifest = {
    sourceSlug: options.sourceSlug,
    collectorId: options.collectorId,
    inputUrl: options.inputUrl,
    requiredField: options.requiredField,
  };
  const source = manifestSource(manifest);
  const before = await readJsonArtifact(options.repoRoot, options.beforePath);
  const beforeEnvelope = assertCaptureEnvelope(before.value, manifest, source, "before");
  assertBrokenBefore(beforeEnvelope, manifest, source);
  if (options.downstreamPaths.length === 0) fail("at least one downstream consumer file is required");
  const downstreamSet = new Set(options.downstreamPaths);
  const missingDownstream = REQUIRED_DOWNSTREAM_PATHS.filter((file) => !downstreamSet.has(file));
  if (missingDownstream.length > 0) fail(`downstream baseline is incomplete; missing ${missingDownstream.join(", ")}`);
  const downstream = await Promise.all(options.downstreamPaths.map((file) => hashRepositoryFile(options.repoRoot, file)));
  return {
    schema_version: HEALING_HARNESS_SCHEMA_VERSION,
    evidence_type: "healing-baseline",
    source_slug: manifest.sourceSlug,
    collector_id: manifest.collectorId,
    input_url: manifest.inputUrl,
    required_field: manifest.requiredField,
    before_artifact: before.hash,
    downstream_files: downstream,
  };
}

export async function createHealingProof(options: { repoRoot: string; baseline: HealingBaseline; previewPath: string; afterPath: string }): Promise<HealingProof> {
  const manifest = manifestFromBaseline(options.baseline);
  const source = manifestSource(manifest);
  const before = await readJsonArtifact(options.repoRoot, options.baseline.before_artifact.path);
  if (before.hash.sha256 !== options.baseline.before_artifact.sha256) fail("before artifact changed after baseline capture");
  const beforeEnvelope = assertCaptureEnvelope(before.value, manifest, source, "before");
  const beforeRows = assertBrokenBefore(beforeEnvelope, manifest, source);
  const preview = await readJsonArtifact(options.repoRoot, options.previewPath);
  const previewEnvelope = assertCaptureEnvelope(preview.value, manifest, source, "preview");
  assertPreview(previewEnvelope, manifest);
  const after = await readJsonArtifact(options.repoRoot, options.afterPath);
  const afterEnvelope = assertCaptureEnvelope(after.value, manifest, source, "after");
  const afterRows = assertRecoveredAfter(afterEnvelope, manifest, source);
  const files: DownstreamFileHash[] = [];
  for (const expected of options.baseline.downstream_files) {
    const current = await hashRepositoryFile(options.repoRoot, expected.path);
    files.push({ path: current.path, sha256: current.sha256, beforeSha256: expected.sha256, afterSha256: current.sha256 });
    if (current.sha256 !== expected.sha256) fail("a downstream consumer file changed during healing");
  }
  return {
    schema_version: HEALING_HARNESS_SCHEMA_VERSION,
    evidence_type: "healing-proof",
    status: "passed",
    source_slug: manifest.sourceSlug,
    collector_id: manifest.collectorId,
    input_url: manifest.inputUrl,
    required_field: manifest.requiredField,
    before: { ...before.hash, rows: beforeRows, contract: "failed" },
    preview: { ...preview.hash, status: "previewed" },
    after: { ...after.hash, rows: afterRows.rows, valid_rows: afterRows.validRows, contract: "passed" },
    downstream: { unchanged: true, files },
  };
}
