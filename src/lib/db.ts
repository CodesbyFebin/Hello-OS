import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { isAbsolute, join, resolve } from 'node:path'

// Inlined copy of resolveDatabaseUrl() from ./db-config (see the note there).
export function resolveDatabaseUrl(url: string | undefined, cwd: string = process.cwd()): string | undefined {
  if (!url) return url
  const m = /^file:(?!\/\/)(.*)$/i.exec(url.trim())
  if (!m) return url
  const q = m[1].indexOf('?')
  const path = q < 0 ? m[1] : m[1].slice(0, q)
  const query = q < 0 ? '' : m[1].slice(q + 1)
  if (!path || isAbsolute(path)) return url
  const root = cwd.replace(/[\\/]\.next[\\/]standalone[\\/]?$/, '') || cwd
  return `file:${resolve(join(root, 'prisma'), path)}${query ? `?${query}` : ''}`
}

// DATABASE_URL=libsql://...  → Turso / sqld through the libSQL driver adapter
//                               (auth via TURSO_AUTH_TOKEN). Used on Vercel.
// DATABASE_URL=file:...       → local SQLite file, Prisma's built-in engine (dev).
// (Same rule as dbMode() in ./db-config, inlined so tests without the alias loader can import this file.)
// Optional: HELLO_DB_ADAPTER=libsql forces the adapter for a file: URL (tests).
//
// Secret key material is never returned by default. Code that must sign
// has to opt in explicitly with `omit: { privateKeyHex: false }`.
function createClient() {
  const url = resolveDatabaseUrl(process.env.DATABASE_URL) ?? ''
  const useAdapter = /^libsql:\/\//i.test(url.trim()) || (process.env.HELLO_DB_ADAPTER === 'libsql' && url.length > 0)
  const options = {
    log: ['error', 'warn'] as ('error' | 'warn')[],
    omit: { agent: { privateKeyHex: true as const } },
    datasourceUrl: url || undefined,
  }
  if (useAdapter) {
    const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined })
    const { datasourceUrl: _unused, ...rest } = options
    void _unused
    return new PrismaClient({ ...rest, adapter })
  }
  return new PrismaClient(options)
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
