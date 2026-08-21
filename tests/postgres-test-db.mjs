import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../db/schema.ts";

const adminUrl = process.env.RASTER_TEST_ADMIN_DATABASE_URL ?? "postgres://localhost/postgres";

export async function createPostgresTestDatabase() {
  const name = `raster_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(adminUrl, { max: 1, prepare: false });
  let client;
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    const url = new URL(adminUrl);
    url.pathname = `/${name}`;
    client = postgres(url.toString(), { max: 8, prepare: false });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: new URL("../drizzle-postgres", import.meta.url).pathname });

    return {
      db,
      sql: client,
      async close() {
        await client.end({ timeout: 5 });
        await admin.unsafe("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [name]);
        await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
        await admin.end({ timeout: 5 });
      },
    };
  } catch (error) {
    await client?.end({ timeout: 5 }).catch(() => {});
    await admin.unsafe("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [name]).catch(() => {});
    await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`).catch(() => {});
    await admin.end({ timeout: 5 }).catch(() => {});
    throw error;
  }
}
