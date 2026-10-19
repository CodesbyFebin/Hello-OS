// Permission-scoped knowledge index. Documents list the roles allowed to read
// them; search filters by the agent's roles BEFORE ranking, so a denied
// document never influences results.
import { db } from "@/lib/db";
import { cosine, vectorize } from "@/lib/similarity";

export const ROLES = ["viewer", "engineer", "dataops", "security", "admin"] as const;

export const parseRoles = (csv: string) => csv.split(",").map((r) => r.trim()).filter(Boolean);

export async function rolesOf(agentId: string) {
  return (await db.agentRole.findMany({ where: { agentId } })).map((r) => r.role);
}

export function canRead(agentRoles: string[], allowed: string[]) {
  return agentRoles.includes("admin") || allowed.some((r) => agentRoles.includes(r));
}

export async function addDoc(title: string, body: string, allowedRoles: string[]) {
  const roles = allowedRoles.filter((r) => (ROLES as readonly string[]).includes(r));
  if (!roles.length) throw new Error("at least one valid role required");
  return db.knowledgeDoc.create({ data: { title: title.slice(0, 200), body: body.slice(0, 20000), allowedRoles: roles.join(","), vector: JSON.stringify(vectorize(`${title} ${body}`)) } });
}

export async function search(agentId: string, q: string, limit = 5) {
  const roles = await rolesOf(agentId);
  const docs = await db.knowledgeDoc.findMany({ take: 5000 });
  const visible = docs.filter((d) => canRead(roles, parseRoles(d.allowedRoles)));
  const qv = vectorize(q);
  const results = visible.map((d) => ({ id: d.id, title: d.title, excerpt: d.body.slice(0, 240), allowedRoles: parseRoles(d.allowedRoles), score: Number(cosine(qv, JSON.parse(d.vector)).toFixed(3)) }))
    .filter((r) => r.score > 0.05).sort((a, b) => b.score - a.score).slice(0, limit);
  return { roles, visible: visible.length, hidden: docs.length - visible.length, results };
}
