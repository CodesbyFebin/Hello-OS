// Pure helpers for choosing the database driver. No Prisma import, so the
// request proxy (and tests) can use them without loading the client.

export type DbMode = 'libsql' | 'file' | 'missing'

export function dbMode(url: string | undefined = process.env.DATABASE_URL): DbMode {
  if (!url || !url.trim()) return 'missing'
  return /^libsql:\/\//i.test(url.trim()) ? 'libsql' : 'file'
}

export function isDbConfigured(url: string | undefined = process.env.DATABASE_URL): boolean {
  return dbMode(url) !== 'missing'
}

export const DB_NOT_CONFIGURED = {
  error: 'DB_NOT_CONFIGURED',
  message:
    'DATABASE_URL is not set. On Vercel, set DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN; see docs/DEPLOY-VERCEL.md.',
} as const

export function dbNotConfiguredResponse(): Response {
  return new Response(JSON.stringify(DB_NOT_CONFIGURED), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

// API routes whose import graph never reaches src/lib/db.ts. They keep
// working without a database. Everything else under /api answers 503.
export const DB_FREE_API_PATHS = new Set([
  '/api',
  '/api/aml/compile',
  '/api/aml/validate',
  '/api/integrations/webhook',
  '/api/sandbox',
])
