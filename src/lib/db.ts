import { PrismaClient } from '@prisma/client'

// Secret key material is never returned by default. Code that must sign
// has to opt in explicitly with `omit: { privateKeyHex: false }`.
function createClient() {
  return new PrismaClient({
    log: ['error', 'warn'],
    omit: { agent: { privateKeyHex: true } },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
