import { Pool, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL ?? "";
if (!connectionString) throw new Error("DATABASE_URL environment variable is required.");

export const pool = new Pool({
  connectionString,
  ssl: /supabase\.co/.test(connectionString) ? { rejectUnauthorized: false } : false,
});

export async function queryDb<T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]) {
  return pool.query<T>(text, params ? [...params] : undefined);
}
