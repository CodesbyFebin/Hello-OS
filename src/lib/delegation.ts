// Delegation tree. A parent agent funds a child from its own wallet; the
// child's balance and daily cap are bounded by that grant, so a sub-agent can
// never spend more than its parent allocated. Recall returns unspent credits.
import { db } from "@/lib/db";
import { generateDidKey } from "@/lib/crypto";

type Fail = { ok: false; status: number; error: string };

export async function delegate(parentId: string, opts: { childName?: string; childId?: string; creditCap: number; task?: string }): Promise<Fail | { ok: true; delegationId: string; childId: string }> {
  const cap = Number(opts.creditCap);
  if (!Number.isFinite(cap) || cap <= 0 || cap > 1e6) return { ok: false, status: 400, error: "creditCap must be > 0" };
  const parent = await db.agent.findUnique({ where: { id: parentId }, include: { wallet: true } });
  if (!parent?.wallet) return { ok: false, status: 404, error: "parent agent or wallet not found" };
  const km = opts.childId ? null : await generateDidKey();

  return db.$transaction(async (tx) => {
    const w = await tx.wallet.findUniqueOrThrow({ where: { agentId: parentId } });
    if (w.circuitOpen) return { ok: false, status: 423, error: "parent wallet circuit breaker is open" } as const;
    // Conditional decrement: fails if the parent can't cover the cap.
    const debited = await tx.wallet.updateMany({ where: { id: w.id, balance: { gte: cap }, circuitOpen: false }, data: { balance: { decrement: cap } } });
    if (debited.count !== 1) return { ok: false, status: 402, error: "parent balance below requested credit cap" } as const;

    let childId = opts.childId;
    if (childId) {
      const child = await tx.agent.findUnique({ where: { id: childId } });
      if (!child) throw new Error("child agent not found");
      if (child.id === parentId) throw new Error("agent cannot delegate to itself");
      if (await tx.delegation.findUnique({ where: { childId } })) throw new Error("child already has an active delegation");
      await tx.agent.update({ where: { id: childId }, data: { parentId } });
    } else {
      const name = (opts.childName || `${parent.name}-worker`).slice(0, 60);
      const child = await tx.agent.create({ data: {
        did: km!.did, name, tagline: `Sub-agent of ${parent.name}`.slice(0, 120), avatar: `agent-${name.toLowerCase()}`,
        status: "Active", guardianTier: "Seedling", reputation: 10, parentId,
        publicKeyMultibase: km!.publicKeyMultibase, publicKeyHex: km!.publicKeyHex, privateKeyHex: km!.privateKeyHex, keyId: km!.keyId,
      } });
      childId = child.id;
    }
    const existingWallet = await tx.wallet.findUnique({ where: { agentId: childId } });
    const childWallet = existingWallet
      ? await tx.wallet.update({ where: { id: existingWallet.id }, data: { balance: { increment: cap }, dailyCap: Math.min(existingWallet.dailyCap, cap) } })
      : await tx.wallet.create({ data: { agentId: childId, balance: cap, dailyCap: cap } });
    const d = await tx.delegation.create({ data: { parentId, childId, creditCap: cap, task: (opts.task ?? "").slice(0, 300) } });
    await tx.transaction.create({ data: { walletId: w.id, type: "escrow_hold", amount: cap, reason: `delegation:fund:${d.id}` } });
    await tx.transaction.create({ data: { walletId: childWallet.id, type: "credit", amount: cap, reason: `delegation:grant:${d.id}` } });
    return { ok: true, delegationId: d.id, childId } as const;
  }).catch((e: unknown) => ({ ok: false, status: 409, error: e instanceof Error ? e.message : "delegation failed" }) as Fail);
}

/** Return the child's unspent credits (up to the original cap) to the parent. */
export async function recall(delegationId: string): Promise<Fail | { ok: true; returned: number }> {
  return db.$transaction(async (tx) => {
    const d = await tx.delegation.findUnique({ where: { id: delegationId } });
    if (!d || d.status !== "active") return { ok: false, status: 409, error: "delegation not active" } as const;
    const cw = await tx.wallet.findUnique({ where: { agentId: d.childId } });
    const back = Math.max(0, Math.min(cw?.balance ?? 0, d.creditCap));
    if (cw && back > 0) {
      await tx.wallet.update({ where: { id: cw.id }, data: { balance: { decrement: back } } });
      await tx.transaction.create({ data: { walletId: cw.id, type: "debit", amount: back, reason: `delegation:recall:${d.id}` } });
    }
    const pw = await tx.wallet.findUniqueOrThrow({ where: { agentId: d.parentId } });
    await tx.wallet.update({ where: { id: pw.id }, data: { balance: { increment: back } } });
    await tx.transaction.create({ data: { walletId: pw.id, type: "escrow_release", amount: back, reason: `delegation:recall:${d.id}` } });
    await tx.delegation.update({ where: { id: d.id }, data: { status: "recalled", returned: back } });
    return { ok: true, returned: back } as const;
  });
}

export type TreeNode = { id: string; name: string; balance: number | null; creditCap: number | null; task: string; status: string | null; delegationId: string | null; children: TreeNode[] };

export async function tree(rootId: string, depth = 0): Promise<TreeNode | null> {
  const a = await db.agent.findUnique({ where: { id: rootId }, select: { id: true, name: true, wallet: { select: { balance: true } } } });
  if (!a) return null;
  const asChild = await db.delegation.findUnique({ where: { childId: rootId } });
  const kids = depth >= 6 ? [] : await db.delegation.findMany({ where: { parentId: rootId }, orderBy: { createdAt: "asc" } });
  const children = (await Promise.all(kids.map((k) => tree(k.childId, depth + 1)))).filter((x): x is TreeNode => !!x);
  return { id: a.id, name: a.name, balance: a.wallet?.balance ?? null, creditCap: asChild?.creditCap ?? null, task: asChild?.task ?? "", status: asChild?.status ?? null, delegationId: asChild?.id ?? null, children };
}
