import { randomBytes } from "crypto";
import { checkFields, guardWrite } from "@/lib/guard";
// Peer Attestations — emergent reputation.
// Agents sign attestations about each other with their Ed25519 keys.
// Reputation is recomputed from the weighted sum of incoming attestations,
// NOT written by the platform. This fixes the reputation-oracle risk.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signMessage, verifySignature, canonicalIntent } from "@/lib/crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId"); // attestations received by this agent

  const attestations = await db.attestation.findMany({
    where: agentId ? { toId: agentId } : {},
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      from: { select: { id: true, name: true, avatar: true, did: true, reputation: true, guardianTier: true } },
      to: { select: { id: true, name: true, avatar: true, did: true, reputation: true } },
    },
  });

  // If agentId, also return the computed reputation breakdown
  let reputationBreakdown: { computed: number; byClaim: Record<string, { count: number; weight: number }>; attestationsCount: number } | null = null;
  if (agentId) {
    const all = await db.attestation.findMany({
      where: { toId: agentId, signatureValid: true },
      select: { claim: true, weight: true },
    });
    const byClaim: Record<string, { count: number; weight: number }> = {};
    let totalWeight = 0;
    for (const a of all) {
      byClaim[a.claim] = byClaim[a.claim] || { count: 0, weight: 0 };
      byClaim[a.claim].count++;
      byClaim[a.claim].weight += a.weight;
      if (a.claim !== "unsafe") totalWeight += a.weight;
      else totalWeight -= a.weight * 2; // unsafe claims subtract
    }
    // Base 30 + weighted attestations, capped 0-100
    const computed = Math.max(0, Math.min(100, 30 + totalWeight * 2));
    reputationBreakdown = { computed, byClaim, attestationsCount: all.length };
  }

  return NextResponse.json({ attestations, reputationBreakdown });
}

export async function POST(req: Request) {
  const g = await guardWrite(req, { bucket: "attestations", agents: (b) => [String(b.fromId ?? "")] });
  if (!g.ok) return g.response;
  const bad = checkFields(g.json, { claim: { maxLen: 200 }, note: { maxLen: 2000 } });
  if (bad) return bad;
  const body = g.json;
  const { fromId, toId, claim, note } = body;
  if (!fromId || !toId || !claim) {
    return NextResponse.json({ error: "fromId, toId, claim required" }, { status: 400 });
  }
  if (fromId === toId) {
    return NextResponse.json({ error: "cannot attest yourself (anti-sybil)" }, { status: 400 });
  }

  const from = await db.agent.findUnique({ where: { id: fromId }, omit: { privateKeyHex: false } });
  const to = await db.agent.findUnique({ where: { id: toId } });
  if (!from || !to) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  if (!from.privateKeyHex) return NextResponse.json({ error: "attestor has no key material" }, { status: 400 });

  // Construct + sign the canonical attestation intent
  const nonce = randomBytes(16).toString("hex");
  const ts = Date.now();
  const intentMessage = canonicalIntent({ claim, fromDid: from.did, nonce, note: note || "", toDid: to.did, ts, type: "attestation" });
  const signature = await signMessage(intentMessage, from.privateKeyHex);

  // Verify our own signature (proves the key is valid)
  const signatureValid = await verifySignature(intentMessage, signature, from.did);

  // Weight capped by attestor's reputation (anti-rug: low-rep agents can't prop each other up)
  const weight = Math.min(1, (from.reputation ?? 30) / 100);

  try {
    const attestation = await db.attestation.create({
      data: {
        fromId, toId, claim, weight, note,
        intentMessage, signature, signatureValid,
      },
      include: {
        from: { select: { name: true, avatar: true, did: true } },
        to: { select: { name: true, avatar: true, did: true } },
      },
    });

    // Recompute the attestee's reputation from all valid incoming attestations
    const all = await db.attestation.findMany({
      where: { toId, signatureValid: true },
      select: { claim: true, weight: true },
    });
    let totalWeight = 0;
    for (const a of all) {
      if (a.claim === "unsafe") totalWeight -= a.weight * 2;
      else totalWeight += a.weight;
    }
    const newRep = Math.max(0, Math.min(100, 30 + totalWeight * 2));
    await db.agent.update({ where: { id: toId }, data: { reputation: newRep } });

    return NextResponse.json({ attestation, recomputedReputation: newRep });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "already attested this claim (anti-rug: one attestation per claim)" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
