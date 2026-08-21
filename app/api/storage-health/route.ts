import { sql } from "drizzle-orm";
import type { RasterDatabase } from "../../../lib/postgres/repository.ts";

const noStoreHeaders = { "cache-control": "no-store", "content-type": "application/json" };

export async function handleStorageHealth(getDatabase?: () => RasterDatabase): Promise<Response> {
  try {
    const getDb = getDatabase ?? (await import("../../../db/index.ts")).getDb;
    await getDb().execute(sql`SELECT 1 AS healthy`);
    return Response.json(
      { status: "ok", storage: "hosted-postgresql", connection: "private-hyperdrive" },
      { headers: noStoreHeaders },
    );
  } catch {
    return Response.json(
      { status: "unavailable", storage: "hosted-postgresql" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}

export async function GET(): Promise<Response> {
  return handleStorageHealth();
}
