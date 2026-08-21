import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
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
const inputUrlKeys = new Set(["inputurl", "targeturl", "runurl"]);
const collectorIdKeys = new Set(["collectorid", "collector"]);
const sourceSlugKeys = new Set(["sourceslug", "source"]);
const rowContainerKeys = new Set(["data", "items", "output", "products", "records", "results", "rows"]);

function fail(message: string): never {
  throw new HealingHarnessError(message);
}

function normalizedKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
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
    const { realpath } = await import("node:fs/promises");
    return await realpath(value);
  } catch {
    fail("path does not exist");
  }
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

function collectStringsForKeys(value: unknown, keys: ReadonlySet<string>, output: string[], depth = 0): void {
  if (depth > 12 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringsForKeys(item, keys, output, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(normalizedKey(key))) {
      if (typeof child === "string") output.push(child);
      else if (Array.isArray(child)) child.forEach((item) => { if (typeof item === "string") output.push(item); });
      else if (isObject(child)) Object.values(child).forEach((item) => { if (typeof item === "string") output.push(item); });
    }
    collectStringsForKeys(child, keys, output, depth + 1);
  }
}

function collectCollectorIds(value: unknown, output: Set<string>, depth = 0): void {
  if (depth > 12 || value === null || value === undefined) return;
  if (typeof value === "string") {
    if (collectorIdPattern.test(value)) output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectCollectorIds(item, output, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  Object.values(value).forEach((child) => collectCollectorIds(child, output, depth + 1));
}

function collectRows(value: unknown, output: Record<string, unknown>[], key = "", depth = 0): void {
  if (depth > 12 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    if (rowContainerKeys.has(normalizedKey(key))) {
      value.forEach((item) => { if (isObject(item)) output.push(item); });
      return;
    }
    value.forEach((item) => collectRows(item, output, key, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  Object.entries(value).forEach(([childKey, child]) => collectRows(child, output, childKey, depth + 1));
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

function assertArtifactIdentity(value: unknown, manifest: HealingManifest, source: SourceDefinition): void {
  const collectorIds = new Set<string>();
  collectCollectorIds(value, collectorIds);
  const explicitCollectorIds: string[] = [];
  collectStringsForKeys(value, collectorIdKeys, explicitCollectorIds);
  if (explicitCollectorIds.length === 0 || collectorIds.size !== 1 || !collectorIds.has(manifest.collectorId) || explicitCollectorIds.some((id) => id !== manifest.collectorId)) {
    fail("provider artifact must contain exactly the expected Collector ID");
  }
  const sourceSlugs: string[] = [];
  collectStringsForKeys(value, sourceSlugKeys, sourceSlugs);
  if (sourceSlugs.length === 0) fail("provider artifact must contain the fixed source slug");
  if (sourceSlugs.some((slug) => slug !== manifest.sourceSlug)) fail("provider artifact source does not match the fixed source");
  const inputUrls: string[] = [];
  collectStringsForKeys(value, inputUrlKeys, inputUrls);
  if (inputUrls.length === 0) fail("provider artifact must contain the fixed input URL");
  if (inputUrls.some((url) => url !== manifest.inputUrl)) fail("provider artifact input does not match the fixed input URL");
  if (!source) fail("source definition is unavailable");
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

function rowsIn(value: unknown): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  collectRows(value, rows);
  if (rows.length === 0 && isObject(value)) rows.push(value);
  if (rows.length === 0) fail("provider artifact contains no object rows");
  return rows;
}

function assertBrokenBefore(value: unknown, manifest: HealingManifest, source: SourceDefinition): number {
  const rows = rowsIn(value);
  const results = rows.map((row) => validateRawOffer(row as RawOffer, manifest.sourceSlug, source));
  if (results.some((result) => result.ok)) fail("before artifact unexpectedly contains a valid contract row");
  const expected = requiredError[manifest.requiredField];
  if (!rows.some((row, index) => !requiredValuePresent(row, manifest.requiredField) && !results[index].ok && results[index].errors.includes(expected))) {
    fail("before artifact does not prove the selected required field failed");
  }
  return rows.length;
}

function assertPreview(value: unknown, manifest: HealingManifest): void {
  const statuses: string[] = [];
  collectStringsForKeys(value, new Set(["status", "state", "phase"]), statuses);
  if (!statuses.some((status) => /preview|approval|approved|ready|heal/i.test(status))) fail("preview artifact lacks an approval/preview status");
  if (manifest.requiredField.length === 0) fail("requiredField is invalid");
}

function assertRecoveredAfter(value: unknown, manifest: HealingManifest, source: SourceDefinition): { rows: number; validRows: number } {
  const rows = rowsIn(value);
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
  assertArtifactIdentity(before.value, manifest, source);
  assertBrokenBefore(before.value, manifest, source);
  if (options.downstreamPaths.length === 0) fail("at least one downstream consumer file is required");
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
  assertArtifactIdentity(before.value, manifest, source);
  const beforeRows = assertBrokenBefore(before.value, manifest, source);
  const preview = await readJsonArtifact(options.repoRoot, options.previewPath);
  assertArtifactIdentity(preview.value, manifest, source);
  assertPreview(preview.value, manifest);
  const after = await readJsonArtifact(options.repoRoot, options.afterPath);
  assertArtifactIdentity(after.value, manifest, source);
  const afterRows = assertRecoveredAfter(after.value, manifest, source);
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
