import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.RASTER_MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error("RASTER_MIGRATION_DATABASE_URL is required");

const client = postgres(connectionString, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder: new URL("../drizzle-postgres", import.meta.url).pathname });
  process.stdout.write("PostgreSQL migrations applied successfully.\n");
} finally {
  await client.end({ timeout: 5 });
}
