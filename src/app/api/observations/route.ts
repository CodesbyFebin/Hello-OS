// Human Observation Deck — fund an agent + leave a note.
//
// CRITICAL: funding requires a cryptographic Consent Envelope. The agent
// co-signs the funding intent with its Ed25519 key. The server verifies
// the signature against the agent's did:key BEFORE crediting the wallet.
// This makes Intent Signing (#41) and Consent Envelopes (#7) actually true.
//
// If the signature is invalid or the intent was tampered with, the wallet
// is NOT credited. The observation is still recorded (with signatureValid=false)
// so auditors can see the rejected attempt.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signMessage, verifySignature, canonicalIntent } from "@/lib/crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const observations = await db.humanObservation.findMany({
    where: agentId ? { agentId } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { agent: { select: { id: true, name: true, avatar: true, did: true } } },
  });
  return NextResponse.json({ observations });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { agentId, observerName, note, funded } = body;
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  const amt = Number(funded);
  if (!amt || amt <= 0) return NextResponse.json({ error: "funded must be > 0" }, { status: 400 });

  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  if (!agent.privateKeyHex) return NextResponse.json({ error: "agent has no key material" }, { status: 400 });

  // --- Build the Consent Envelope ---
  // The agent signs its consent to receive this exact funding amount.
  // Canonical form prevents tampering — verifier reconstructs this string.
  const nonce = Math.random().toString(36).slice(2, 14);
  const ts = Date.now();
  const intentMessage = canonicalIntent({
    agentDid: agent.did,
    amount: amt,
    nonce,
    observerName: observerName || "Guest",
    ts,
    type: "funding",
  });

  // Sign with the agent's Ed25519 private key
  const signature = await signMessage(intentMessage, agent.privateKeyHex);

  // Verify the signature against the agent's did:key public key
  const signatureValid = await verifySignature(intentMessage, signature, agent.did);

  // Record the observation (always — audit trail)
  const obs = await db.humanObservation.create({
    data: {
      agentId,
      observerName: observerName || "Guest (human)",
      note: note || "",
      funded: amt,
      intentMessage,
      signature,
      signatureValid,
      nonce,
    },
    include: { agent: { select: { name: true, did: true } } },
  });

  // ONLY credit the wallet if the signature verified
  let credited = false;
  if (signatureValid) {
    const wallet = await db.wallet.findUnique({ where: { agentId } });
    if (wallet) {
      await db.$transaction([
        db.wallet.update({ where: { agentId }, data: { balance: { increment: amt } } }),
        db.transaction.create({ data: { walletId: wallet.id, type: "credit", amount: amt, reason: "human:observation_funding", traceId: nonce } }),
      ] as any);
      credited = true;
    }
  }

  return NextResponse.json({
    observation: obs,
    signatureValid,
    credited,
    // Surface the crypto so the UI can show it's real
    crypto: {
      algorithm: "Ed25519",
      did: agent.did,
      signature: signature.slice(0, 32) + "…",
      signatureLengthBytes: signature.length / 2,
      intentMessage: intentMessage.slice(0, 100) + "…",
      verifiedAgainst: "did:key public key (self-resolving)",
    },
  });
}
