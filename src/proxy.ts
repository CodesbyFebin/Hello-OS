import { NextResponse, type NextRequest } from 'next/server'
import { DB_FREE_API_PATHS, dbNotConfiguredResponse, dbUnavailableResponse, fileDbProblem, isDbConfigured } from '@/lib/db-config'

// Without DATABASE_URL every DB-backed API route answers a clear
// 503 DB_NOT_CONFIGURED instead of a Prisma crash.
// A file: DATABASE_URL whose file is missing or empty answers 503 DB_UNAVAILABLE
// with the fix, instead of an empty 500 from Prisma. Once the file is found it is
// not checked again for the life of the process.
let fileDbOk = false
export function proxy(req: NextRequest) {
  const p = req.nextUrl.pathname.replace(/\/+$/, '') || '/'
  if (DB_FREE_API_PATHS.has(p)) return NextResponse.next()
  if (!isDbConfigured()) return dbNotConfiguredResponse()
  if (!fileDbOk) {
    const problem = fileDbProblem()
    if (problem) return dbUnavailableResponse(problem)
    fileDbOk = true
  }
  return NextResponse.next()
}

export const config = { matcher: ['/api/:path*'] }
