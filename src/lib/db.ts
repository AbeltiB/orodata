import { Pool, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL ?? "";
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required.");
}

const config = {
  connectionString,
  ssl: /supabase\.co/.test(connectionString)
    ? { rejectUnauthorized: false }
    : false,
};

export const pool = new Pool(config);

export async function queryDb<T extends QueryResultRow = any>(text: string, params?: unknown[]) {
  const result = await pool.query<T>(text, params as any);
  return result;
}
