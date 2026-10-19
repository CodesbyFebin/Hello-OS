import { db } from "@/lib/db";
import { spendWallet } from "@/lib/economy";

/** Debit the skill price and record the installation in one transaction. */
export async function installSkill(agentId: string, skillId: string) {
  const skill = await db.skill.findUnique({ where: { id: skillId } });
  if (!skill) return { ok: false as const, status: 404, error: "skill not found" };
  try {
    const result = await spendWallet(agentId, skill.price, `skill:install:${skill.name}`, undefined, async (tx) => {
      const existing = await tx.skillInstallation.findUnique({ where: { skillId_agentId: { skillId, agentId } } });
      if (existing) throw new Error("already installed");
      const installation = await tx.skillInstallation.create({ data: { skillId, agentId } });
      await tx.skill.update({ where: { id: skillId }, data: { installs: { increment: 1 } } });
      return installation;
    });
    if (!result.ok) return { ok: false as const, status: result.status, error: result.error, wallet: result.wallet };
    return { ok: true as const, installation: result.extra, wallet: result.wallet };
  } catch (error) {
    const message = error instanceof Error ? error.message : "install failed";
    return { ok: false as const, status: message === "already installed" ? 409 : 500, error: message };
  }
}
