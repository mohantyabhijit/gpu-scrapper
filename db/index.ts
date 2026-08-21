import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type RasterBindings = { HYPERDRIVE?: Hyperdrive };

export function getDb() {
  const bindings = env as unknown as RasterBindings;
  if (!bindings.HYPERDRIVE) throw new Error("Cloudflare Hyperdrive binding `HYPERDRIVE` is unavailable. Configure the private hosted PostgreSQL connection before using the database.");
  const client = postgres(bindings.HYPERDRIVE.connectionString, { max: 5, prepare: false });
  return drizzle(client, { schema });
}
