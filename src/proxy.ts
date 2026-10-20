import { NextResponse, type NextRequest } from 'next/server'
import { DB_FREE_API_PATHS, dbNotConfiguredResponse, isDbConfigured } from '@/lib/db-config'

// Without DATABASE_URL every DB-backed API route answers a clear
// 503 DB_NOT_CONFIGURED instead of a Prisma crash.
export function proxy(req: NextRequest) {
  if (isDbConfigured()) return NextResponse.next()
  const p = req.nextUrl.pathname.replace(/\/+$/, '') || '/'
  if (DB_FREE_API_PATHS.has(p)) return NextResponse.next()
  return dbNotConfiguredResponse()
}

export const config = { matcher: ['/api/:path*'] }
