import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// DATABASE_URL=libsql://...  → Turso / sqld through the libSQL driver adapter
//                               (auth via TURSO_AUTH_TOKEN). Used on Vercel.
// DATABASE_URL=file:...       → local SQLite file, Prisma's built-in engine (dev).
// (Same rule as dbMode() in ./db-config, inlined so tests without the alias loader can import this file.)
// Optional: HELLO_DB_ADAPTER=libsql forces the adapter for a file: URL (tests).
//
// Secret key material is never returned by default. Code that must sign
// has to opt in explicitly with `omit: { privateKeyHex: false }`.
function createClient() {
  const url = process.env.DATABASE_URL ?? ''
  const useAdapter = /^libsql:\/\//i.test(url.trim()) || (process.env.HELLO_DB_ADAPTER === 'libsql' && url.length > 0)
  const options = {
    log: ['error', 'warn'] as ('error' | 'warn')[],
    omit: { agent: { privateKeyHex: true as const } },
  }
  if (useAdapter) {
    const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined })
    return new PrismaClient({ ...options, adapter })
  }
  return new PrismaClient(options)
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
