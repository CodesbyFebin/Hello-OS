// Operator authorization for mutating/privileged routes.
//
//   HELLO_OPERATOR_TOKEN set      → request must send it as `x-operator-token`
//                                   (or `Authorization: Bearer <token>`). Compared in constant time.
//   unset, production             → FAIL CLOSED (503 OPERATOR_TOKEN_NOT_CONFIGURED).
//                                   Production = NODE_ENV=production or VERCEL set.
//   unset, local development      → dev mode: allowed, and responses say devMode: true.
//   HELLO_OPERATOR_DEV_MODE=1     → explicit opt-in to dev mode even in production
//                                   (e.g. `npm start` on a laptop). Never set this on a public deployment.
import { createHash, timingSafeEqual } from "node:crypto";

type Env = Record<string, string | undefined>;

export type OperatorAuth =
  | { ok: true; devMode: boolean }
  | { ok: false; devMode: false; status: 401 | 503; code: "OPERATOR_TOKEN_REQUIRED" | "OPERATOR_TOKEN_NOT_CONFIGURED"; error: string };

export function isProductionEnv(env: Env = process.env): boolean {
  return env.NODE_ENV === "production" || Boolean(env.VERCEL);
}

function presented(req: Request): string | null {
  const h = req.headers.get("x-operator-token");
  if (h) return h;
  const a = req.headers.get("authorization");
  const m = a?.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function same(a: string, b: string): boolean {
  // Hash first so lengths match and timing does not reveal the token length.
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function operatorAuth(req: Request, env: Env = process.env): OperatorAuth {
  const expected = env.HELLO_OPERATOR_TOKEN?.trim();
  if (!expected) {
    if (isProductionEnv(env) && env.HELLO_OPERATOR_DEV_MODE !== "1") {
      return { ok: false, devMode: false, status: 503, code: "OPERATOR_TOKEN_NOT_CONFIGURED", error: "Operator actions are disabled: HELLO_OPERATOR_TOKEN is not set on this production deployment. Set it in the host's environment variables, then send it as the x-operator-token header." };
    }
    return { ok: true, devMode: true };
  }
  const got = presented(req);
  if (got && same(got, expected)) return { ok: true, devMode: false };
  return { ok: false, devMode: false, status: 401, code: "OPERATOR_TOKEN_REQUIRED", error: "operator token required: send the x-operator-token header" };
}

/** Back-compat boolean helper. */
export function operatorAllowed(req: Request, env: Env = process.env): boolean {
  return operatorAuth(req, env).ok;
}

/** JSON error response for a failed check (route handlers: `if (!a.ok) return operatorDenied(a)`). */
export function operatorDenied(a: Extract<OperatorAuth, { ok: false }>): Response {
  return Response.json({ error: a.error, code: a.code }, { status: a.status });
}
