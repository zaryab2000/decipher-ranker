import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb(): NeonHttpDatabase<typeof schema> {
  if (!process.env.POSTGRES_URL) {
    throw new Error("Missing POSTGRES_URL environment variable");
  }
  const sql = neon(process.env.POSTGRES_URL);
  return drizzle(sql, { schema });
}

let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) _db = createDb();
  return _db;
}
