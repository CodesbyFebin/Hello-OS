// Pure helpers for choosing the database driver. No Prisma import, so the
// request proxy (and tests) can use them without loading the client.

import { statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

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
    'DATABASE_URL is not set. Locally: cp .env.example .env && npx prisma db push, then restart. On Vercel: set DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN; see docs/DEPLOY-VERCEL.md.',
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

/** Project root: the working directory, minus a trailing `.next/standalone` (where `npm start` runs). */
export function projectRoot(cwd: string = process.cwd()): string {
  return cwd.replace(/[\\/]\.next[\\/]standalone[\\/]?$/, '') || cwd
}

/**
 * Prisma resolves a relative `file:` URL against the schema folder (`prisma/`).
 * The standalone server has a different cwd, so resolve it explicitly against
 * `<project root>/prisma`. Absolute paths, libsql:// and empty values pass through.
 * Keep in sync with the inlined copy in ./db.ts (tests/db-url.test.mjs checks both).
 */
export function resolveDatabaseUrl(url: string | undefined, cwd: string = process.cwd()): string | undefined {
  if (!url) return url
  const m = /^file:(?!\/\/)(.*)$/i.exec(url.trim())
  if (!m) return url
  const q = m[1].indexOf('?')
  const path = q < 0 ? m[1] : m[1].slice(0, q)
  const query = q < 0 ? '' : m[1].slice(q + 1)
  if (!path || isAbsolute(path)) return url
  return `file:${resolve(join(projectRoot(cwd), 'prisma'), path)}${query ? `?${query}` : ''}`
}

/** For a file: database, an actionable reason it cannot be opened, or null. */
export function fileDbProblem(url: string | undefined = process.env.DATABASE_URL, cwd: string = process.cwd()): string | null {
  if (dbMode(url) !== 'file') return null
  const resolved = resolveDatabaseUrl(url, cwd) ?? ''
  const file = resolved.replace(/^file:/i, '').split('?')[0]
  try {
    const st = statSync(file)
    if (!st.isFile()) return `DATABASE_URL points to ${file}, which is not a file.`
    if (st.size === 0) return `The database file ${file} is empty (no tables). Run: npx prisma db push`
    return null
  } catch {
    return `The database file ${file} does not exist. From the project root run: npx prisma db push (it uses DATABASE_URL from .env), then restart.`
  }
}

export function dbUnavailableResponse(problem: string): Response {
  return new Response(JSON.stringify({ error: 'DB_UNAVAILABLE', message: problem }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
