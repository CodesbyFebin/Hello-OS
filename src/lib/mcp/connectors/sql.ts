// Read-only SQL connector (connectors #16 PostgreSQL / #18 SQLite).
// Runs against the repo's existing Prisma datasource. Only a single SELECT/WITH
// statement is accepted, it is wrapped in an outer LIMIT, and results are capped.
// Postgres code paths exist but only SQLite is covered by tests.

export interface RawQueryClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export type SqlDialect = "sqlite" | "postgresql";

export const MAX_ROWS = 200;
export const DEFAULT_ROWS = 50;

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|replace|vacuum|reindex|grant|revoke|truncate|copy|into|merge|call|exec|execute|lock|set|load_extension|pg_sleep|pg_read_file|pg_write_file|lo_import|lo_export|dblink)\b/i;

export function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Throws if the statement is not a single read-only SELECT/WITH query. */
export function assertReadOnlySelect(sql: unknown): string {
  if (typeof sql !== "string" || !sql.trim()) throw new Error("sql must be a non-empty string");
  if (sql.length > 10_000) throw new Error("sql exceeds 10,000 characters");
  // Remove string literals before keyword scanning so 'drop' inside a literal is fine.
  const cleaned = stripSqlComments(sql).trim().replace(/;\s*$/, "");
  const noLiterals = cleaned.replace(/'(?:[^']|'')*'/g, "''");
  if (noLiterals.includes(";")) throw new Error("only a single statement is allowed");
  if (!/^(select|with)\b/i.test(noLiterals)) throw new Error("only SELECT or WITH queries are allowed");
  const bad = noLiterals.match(FORBIDDEN);
  if (bad) throw new Error(`keyword not allowed in read-only query: ${bad[0].toUpperCase()}`);
  const secret = noLiterals.match(SENSITIVE_COLUMN);
  if (secret) throw new Error(`secret-bearing column not queryable: ${secret[0]}`);
  return cleaned;
}

// Secret-bearing columns (e.g. Agent.privateKeyHex) are never returned: queries that
// name them are rejected, and any such key in a result row (e.g. via SELECT *) is redacted.
export const SENSITIVE_COLUMN = /(private_?key|secret|password|passwd|api_?key|access_?token|refresh_?token|session_?token|credential)/i;

function redact(rows: Record<string, unknown>[]) {
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, SENSITIVE_COLUMN.test(k) ? "[redacted]" : v])));
}

function jsonSafe(rows: unknown): Record<string, unknown>[] {
  return JSON.parse(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}

export async function readOnlyQuery(db: RawQueryClient, sql: unknown, limit: unknown = DEFAULT_ROWS) {
  const stmt = assertReadOnlySelect(sql);
  const n = Math.max(1, Math.min(MAX_ROWS, Math.floor(Number(limit) || DEFAULT_ROWS)));
  // Fetch n+1 so we can report truncation without returning more than n rows.
  const rows = jsonSafe(await db.$queryRawUnsafe(`SELECT * FROM (${stmt}) AS hello_ro LIMIT ${n + 1}`));
  return { rows: redact(rows.slice(0, n)), rowCount: Math.min(rows.length, n), truncated: rows.length > n, limit: n };
}

export interface ColumnInfo { name: string; type: string; nullable: boolean; primaryKey: boolean }
export interface TableInfo { name: string; columns: ColumnInfo[] }

export function detectDialect(url = process.env.DATABASE_URL || ""): SqlDialect {
  return /^postgres(ql)?:/i.test(url) ? "postgresql" : "sqlite";
}

export async function reflectSchema(db: RawQueryClient, dialect: SqlDialect = detectDialect()): Promise<TableInfo[]> {
  if (dialect === "postgresql") {
    const cols = jsonSafe(await db.$queryRawUnsafe(
      `SELECT c.table_name, c.column_name, c.data_type, c.is_nullable,
              EXISTS (SELECT 1 FROM information_schema.key_column_usage k
                      JOIN information_schema.table_constraints t ON t.constraint_name = k.constraint_name AND t.constraint_type = 'PRIMARY KEY'
                      WHERE k.table_name = c.table_name AND k.column_name = c.column_name AND k.table_schema = c.table_schema) AS pk
       FROM information_schema.columns c WHERE c.table_schema = current_schema()
       ORDER BY c.table_name, c.ordinal_position`));
    const map = new Map<string, ColumnInfo[]>();
    for (const r of cols) {
      const list = map.get(String(r.table_name)) ?? [];
      list.push({ name: String(r.column_name), type: String(r.data_type), nullable: r.is_nullable === "YES", primaryKey: Boolean(r.pk) });
      map.set(String(r.table_name), list);
    }
    return [...map].map(([name, columns]) => ({ name, columns })).sort((a, b) => a.name.localeCompare(b.name));
  }
  const tables = jsonSafe(await db.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name"));
  const out: TableInfo[] = [];
  for (const t of tables) {
    const name = String(t.name);
    if (!/^[A-Za-z0-9_]+$/.test(name)) continue;
    const cols = jsonSafe(await db.$queryRawUnsafe(`SELECT name, type, "notnull" AS nn, pk FROM pragma_table_info('${name}')`));
    out.push({ name, columns: cols.map((c) => ({ name: String(c.name), type: String(c.type), nullable: !Number(c.nn), primaryKey: Number(c.pk) > 0 })) });
  }
  return out;
}
