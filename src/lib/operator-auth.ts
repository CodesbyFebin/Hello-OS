/** If HELLO_OPERATOR_TOKEN is set, mutating operator routes require a matching x-operator-token header. */
export function operatorAllowed(req: Request): boolean {
  const expected = process.env.HELLO_OPERATOR_TOKEN;
  return !expected || req.headers.get("x-operator-token") === expected;
}
