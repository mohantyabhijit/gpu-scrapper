import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";

// This is a disposable test double only. Production schema changes are owned
// by db/schema.ts and drizzle-postgres/, never by this SQLite fixture.
const SQLITE_TEST_SCHEMA = `
CREATE TABLE sources (
  slug TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  market TEXT NOT NULL,
  region TEXT NOT NULL,
  currency TEXT NOT NULL,
  base_url TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'secondary',
  allowed_hosts TEXT NOT NULL DEFAULT '[]',
  catalog_url TEXT NOT NULL DEFAULT '',
  collector_ids TEXT NOT NULL DEFAULT '{}',
  onboarding_status TEXT NOT NULL DEFAULT 'pending',
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE request_receipts (
  key TEXT PRIMARY KEY NOT NULL,
  route TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX request_receipts_expiry_idx ON request_receipts (expires_at);
CREATE TABLE healing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  session_id TEXT NOT NULL,
  source_slug TEXT NOT NULL,
  collector_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  detail TEXT NOT NULL,
  accepted_count INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_slug) REFERENCES sources(slug),
  UNIQUE (session_id, stage)
);
CREATE INDEX healing_events_session_idx ON healing_events (session_id, id);
`;

export function createSqliteTestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(SQLITE_TEST_SCHEMA);
  const d1 = {
    prepare(sql) {
      return {
        bind(...params) {
          const statement = sqlite.prepare(sql);
          const sqliteParams = params.map((value) => typeof value === "boolean" ? (value ? 1 : 0) : value);
          return {
            async first(column) {
              const row = statement.get(...sqliteParams);
              return column && row ? row[column] : row;
            },
            async all() { return { results: statement.all(...sqliteParams), success: true, meta: {} }; },
            async run() { statement.run(...sqliteParams); return { success: true, meta: {} }; },
            async raw() { return statement.all(...sqliteParams).map((row) => Object.values(row)); },
          };
        },
      };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
    async exec(sql) { sqlite.exec(sql); return { count: 0, duration: 0 }; },
  };
  return { sqlite, db: drizzle(d1, { schema }) };
}
