import { Pool, types } from "pg";

// Return timestamps as ISO strings, the same shape the client code and PDF expect.
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) => new Date(value).toISOString());

let pool: Pool | null = null;

function getPool(): Pool {
  // Supabase's server certificate is not in Node's default trust store. The connection is still encrypted.
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });
  return pool;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}
