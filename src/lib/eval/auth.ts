// Promotion decisions fail closed: unlike dev-mode operator routes, they need
// HELLO_OPERATOR_TOKEN to be set AND to match the x-operator-token header.
export function promotionAuthorized(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const expected = env.HELLO_OPERATOR_TOKEN;
  return Boolean(expected) && req.headers.get("x-operator-token") === expected;
}
