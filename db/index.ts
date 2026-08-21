import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RasterBindings = { DB?: D1Database };

export function getDb() {
  const bindings = env as unknown as RasterBindings;
  if (!bindings.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the production database in wrangler.jsonc or let the local runtime inject the binding before using the database."
    );
  }

  return drizzle(bindings.DB, { schema });
}
