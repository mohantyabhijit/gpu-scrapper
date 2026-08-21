import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_SAMPLE_ROWS = 5;
export const MAX_VALUE_LENGTH = 180;

const EVIDENCE_KINDS = new Set(["create", "run", "heal"]);
const ROW_CONTAINER_KEYS = new Set(["data", "items", "output", "products", "records", "results", "rows"]);
const COLLECTOR_ID_PATTERN = /^c_[a-z0-9][a-z0-9_-]{2,80}$/i;
const SENSITIVE_KEY_PATTERN = /(access[_-]?token|api[_-]?key|authorization|bearer|client[_-]?secret|cookie|credential|password|private[_-]?key|provider[_-]?(body|error|response)|raw[_-]?(body|error|response)|refresh[_-]?token|secret|set[_-]?cookie|token)/i;
const SENSITIVE_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
  /\bbearer\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|refresh[_-]?token|secret)\s*[:=]/i,
  /[?&](?:access[_-]?token|api[_-]?key|signature|token)=/i,
];

const PUBLIC_ROW_FIELDS = new Map([
  ["amount", "price"],
  ["availability", "availability"],
  ["boardpartner", "board_partner"],
  ["board_partner", "board_partner"],
  ["currency", "currency"],
  ["currencycode", "currency"],
  ["fetchedat", "observed_at"],
  ["market", "market"],
  ["model", "model"],
  ["mpn", "mpn"],
  ["name", "title"],
  ["price", "price"],
  ["producturl", "product_url"],
  ["retailer", "retailer"],
  ["sku", "sku"],
  ["source_slug", "source_slug"],
  ["sourceslug", "source_slug"],
  ["sourceurl", "product_url"],
  ["stock", "availability"],
  ["stockstatus", "availability"],
  ["title", "title"],
  ["url", "product_url"],
  ["observedat", "observed_at"],
  ["vram", "vram_gb"],
  ["vramgb", "vram_gb"],
]);

const COUNT_FIELDS = new Map([
  ["attempts", "attempts"],
  ["durationms", "duration_ms"],
  ["quarantinedrows", "quarantined_rows"],
  ["rowcount", "rows"],
  ["rows", "rows"],
  ["total", "total"],
  ["totalrows", "rows"],
  ["validrows", "valid_rows"],
]);

function normalizedKey(key) {
  return String(key).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksSensitiveValue(value) {
  return typeof value === "string" && SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function withoutControlCharacters(value) {
  return [...value].map((character) => {
    const code = character.charCodeAt(0);
    if (code === 10 || code === 13) return " ";
    return code < 32 || code === 127 ? "" : character;
  }).join("");
}

function safeString(value) {
  if (typeof value !== "string" || looksSensitiveValue(value)) return undefined;
  const compact = withoutControlCharacters(value).trim();
  return compact ? compact.slice(0, MAX_VALUE_LENGTH) : undefined;
}

function safeScalar(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  return safeString(value);
}

function safePublicUrl(value) {
  if (typeof value !== "string") return undefined;
  const text = withoutControlCharacters(value).trim();
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    url.search = "";
    url.hash = "";
    return url.toString().slice(0, MAX_VALUE_LENGTH);
  } catch {
    return undefined;
  }
}

function collectSensitiveFields(value, stats, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === "string") {
    if (looksSensitiveValue(value)) stats.valuesRemoved += 1;
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectSensitiveFields(item, stats, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      stats.fieldsRemoved += 1;
      continue;
    }
    collectSensitiveFields(child, stats, depth + 1);
  }
}

function collectCollectorIds(value, collectorIds, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === "string") {
    if (COLLECTOR_ID_PATTERN.test(value)) collectorIds.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectCollectorIds(item, collectorIds, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  for (const child of Object.values(value)) collectCollectorIds(child, collectorIds, depth + 1);
}

function sanitizeRow(row) {
  if (!isObject(row)) return undefined;
  const clean = {};
  for (const [key, value] of Object.entries(row)) {
    const publicKey = PUBLIC_ROW_FIELDS.get(normalizedKey(key));
    if (!publicKey || publicKey in clean) continue;
    if (publicKey === "product_url") {
      const url = safePublicUrl(value);
      if (url) clean[publicKey] = url;
      continue;
    }
    if (publicKey === "currency") {
      const currency = safeString(value)?.toUpperCase();
      if (currency && /^[A-Z]{3}$/.test(currency)) clean[publicKey] = currency;
      continue;
    }
    const scalar = safeScalar(value);
    if (scalar !== undefined) clean[publicKey] = scalar;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function collectRows(value, rows, depth = 0, key = "") {
  if (depth > 8 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    if (ROW_CONTAINER_KEYS.has(normalizedKey(key))) {
      value.forEach((item) => rows.push(item));
      return;
    }
    value.forEach((item) => collectRows(item, rows, depth + 1, key));
    return;
  }
  if (!isObject(value)) return;
  for (const [childKey, child] of Object.entries(value)) collectRows(child, rows, depth + 1, childKey);
}

function readStatus(input) {
  if (!isObject(input)) return "reported";
  for (const key of ["status", "state", "result"]) {
    const value = input[key];
    const status = safeString(value)?.toLowerCase();
    if (status && /^[a-z][a-z0-9_-]{0,40}$/.test(status)) return status;
  }
  return "reported";
}

function readPublicUrls(input) {
  if (!isObject(input)) return {};
  const urls = {};
  for (const { keys, outputKey } of [
    { keys: ["target_url", "targetUrl"], outputKey: "target_url" },
    { keys: ["input_url", "inputUrl"], outputKey: "input_url" },
    { keys: ["catalog_url", "catalogUrl"], outputKey: "catalog_url" },
    { keys: ["source_url", "sourceUrl"], outputKey: "source_url" },
  ]) {
    for (const key of keys) {
      const url = safePublicUrl(input[key]);
      if (url) {
        urls[outputKey] = url;
        break;
      }
    }
  }
  return urls;
}

function readCounts(input, fallbackRows) {
  const counts = {};
  if (isObject(input)) {
    for (const [key, value] of Object.entries(input)) {
      const countKey = COUNT_FIELDS.get(normalizedKey(key));
      if (!countKey || typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) continue;
      if (!(countKey in counts)) counts[countKey] = value;
    }
  }
  if (!("rows" in counts) && fallbackRows > 0) counts.rows = fallbackRows;
  return counts;
}

function normalizeKind(kind) {
  const value = String(kind ?? "").toLowerCase();
  if (!EVIDENCE_KINDS.has(value)) throw new Error("evidence kind must be create, run, or heal");
  return value;
}

export function sanitizeEvidence(input, { kind, sourceFile = "input.json", generatedAt = new Date().toISOString() } = {}) {
  const evidenceKind = normalizeKind(kind);
  const stats = { fieldsRemoved: 0, valuesRemoved: 0 };
  const collectorIds = new Set();
  collectSensitiveFields(input, stats);
  collectCollectorIds(input, collectorIds);

  const candidates = [];
  collectRows(input, candidates);
  const sampleRows = candidates.map(sanitizeRow).filter(Boolean).slice(0, MAX_SAMPLE_ROWS);
  const output = {
    schema_version: 1,
    evidence_type: evidenceKind,
    source_file: path.basename(sourceFile),
    generated_at_utc: new Date(generatedAt).toISOString(),
    collector_ids: [...collectorIds].sort(),
    status: readStatus(input),
    counts: readCounts(input, candidates.length),
    sample_rows: sampleRows,
    redactions: {
      sensitive_fields_removed: stats.fieldsRemoved,
      sensitive_values_removed: stats.valuesRemoved,
      provider_payloads_omitted: true,
      sample_rows_seen: candidates.length,
      sample_rows_included: sampleRows.length,
      sample_rows_limit: MAX_SAMPLE_ROWS,
    },
  };
  return { ...output, ...readPublicUrls(input) };
}

function inferKind(inputPath) {
  const name = path.basename(inputPath).toLowerCase();
  return [...EVIDENCE_KINDS].find((kind) => name.includes(kind)) ?? "run";
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error("unexpected command-line argument");
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for --${key}`);
    if (!["input", "output", "kind"].includes(key)) throw new Error(`unsupported option --${key}`);
    values[key] = value;
    index += 1;
  }
  if (!values.input) throw new Error("--input is required");
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let input;
  try {
    input = JSON.parse(await readFile(args.input, "utf8"));
  } catch {
    throw new Error("input must be a readable JSON file");
  }
  const summary = sanitizeEvidence(input, {
    kind: args.kind ?? inferKind(args.input),
    sourceFile: args.input,
  });
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (args.output) {
    await mkdir(path.dirname(args.output), { recursive: true });
    await writeFile(args.output, serialized, "utf8");
    return;
  }
  process.stdout.write(serialized);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => {
    process.stderr.write("evidence sanitization failed\n");
    process.exitCode = 1;
  });
}
