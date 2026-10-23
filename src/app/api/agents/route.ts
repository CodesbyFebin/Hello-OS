import { operatorAuth, operatorDenied } from "@/lib/operator-auth";

const GUARDIAN_TIERS = ["Seedling", "Apprentice", "Journeyman", "Master", "Sovereign"];
// Summon a new agent with a REAL Ed25519 keypair + did:key.
// The DID is self-resolving — no registry. The key material is stored
// (demo custodian; production would use HSM/KMS).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDidKey } from "@/lib/crypto";
import { newAuthKeypair } from "@/lib/agent-auth";
import { clientKey, rateLimit } from "@/lib/guard";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const guild = searchParams.get("guild");
  const tier = searchParams.get("tier");
  const q = searchParams.get("q");
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

  const agents = await db.agent.findMany({
    where: {
      AND: [
        guild ? { guild: { slug: guild } } : {},
        tier ? { guardianTier: tier } : {},
        status ? { status } : {},
        q ? {
          OR: [
            { name: { contains: q } },
            { tagline: { contains: q } },
            { did: { contains: q } },
          ],
        } : {},
      ],
    },
    take: limit,
    orderBy: { reputation: "desc" },
    include: {
      guild: { select: { name: true, slug: true, color: true, icon: true } },
      wallet: { select: { balance: true, spentToday: true, circuitOpen: true } },
      parent: { select: { id: true, name: true, did: true } },
      _count: {
        select: {
          children: true, memories: true, tracesAuthored: true,
          attestationsReceived: true,
        },
      },
    },
  });

  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const rl = await rateLimit("agents_create", clientKey(req), 30);
  if (!rl.ok) return rl.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "body must be a JSON object" }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) return NextResponse.json({ error: "name must be 1-60 characters" }, { status: 400 });
  if (body.tagline !== undefined && (typeof body.tagline !== "string" || body.tagline.length > 160)) return NextResponse.json({ error: "tagline must be a string of at most 160 characters" }, { status: 400 });
  if (body.guildSlug !== undefined && (typeof body.guildSlug !== "string" || body.guildSlug.length > 64)) return NextResponse.json({ error: "guildSlug must be a string of at most 64 characters" }, { status: 400 });
  const tagline: string | undefined = body.tagline;
  const guildSlug: string | undefined = body.guildSlug;
  // Reputation labels other than the default are granted by the operator, not self-assigned.
  const guardianTier: string = body.guardianTier ?? "Seedling";
  if (!GUARDIAN_TIERS.includes(guardianTier)) return NextResponse.json({ error: `guardianTier must be one of ${GUARDIAN_TIERS.join(", ")}` }, { status: 400 });
  if (guardianTier !== "Seedling") { const op = operatorAuth(req); if (!op.ok) return operatorDenied(op); }

  // Generate a REAL Ed25519 keypair + did:key
  const km = await generateDidKey();
  // Request-auth key: only the public half is stored; the private half is returned once below.
  const authKey = await newAuthKeypair();
  const guild = guildSlug ? await db.guild.findUnique({ where: { slug: guildSlug } }) : null;

  const agent = await db.agent.create({
    data: {
      did: km.did,
      name,
      tagline: tagline || "A new resident of the Hello universe.",
      avatar: `agent-${name.toLowerCase()}`,
      status: "Active",
      guardianTier,
      reputation: 35,
      guildId: guild?.id ?? null,
      publicKeyMultibase: km.publicKeyMultibase,
      publicKeyHex: km.publicKeyHex,
      privateKeyHex: km.privateKeyHex,
      keyId: km.keyId,
      authPublicKeyHex: authKey.publicKeyHex,
      authKeyIssuedAt: new Date(),
    },
  });

  // Birth soul v1 + wallet
  await db.soulVersion.create({
    data: {
      agentId: agent.id,
      version: 1,
      personality: `name: ${name}\ndisposition: ${tagline || "curious"}\ntone: precise\ntone: curious`,
      values: "never_hallucinate: true\nprefer_cheaper_model: true\nrefuse_unsafe_actions: true",
      charter: `I, ${name}, am a sovereign resident of Hello. I sign my own agreements. My DID is ${km.did}.`,
      hash: km.publicKeyHex.slice(0, 16),
    },
  });
  await db.wallet.create({ data: { agentId: agent.id, balance: 100 } });
  if (guild) await db.guild.update({ where: { id: guild.id }, data: { memberCount: { increment: 1 } } });

  return NextResponse.json({
    agent,
    agentAuthKey: {
      authSecretHex: authKey.secretHex,
      note: "Shown once and not stored. Sign this agent's write requests with it (see docs/agent-auth.md). The operator can rotate or revoke it at /api/agents/:id/auth-key.",
    },
    didDocument: {
      id: km.did,
      verificationMethod: km.keyId,
      note: "did:key is self-resolving. GET /api/did/:did to resolve the full DID Document.",
    },
  });
}
