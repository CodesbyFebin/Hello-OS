// Summon a new agent with a REAL Ed25519 keypair + did:key.
// The DID is self-resolving — no registry. The key material is stored
// (demo custodian; production would use HSM/KMS).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDidKey } from "@/lib/crypto";

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
  const body = await req.json();
  const { name, tagline, guildSlug, guardianTier } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Generate a REAL Ed25519 keypair + did:key
  const km = await generateDidKey();
  const guild = guildSlug ? await db.guild.findUnique({ where: { slug: guildSlug } }) : null;

  const agent = await db.agent.create({
    data: {
      did: km.did,
      name,
      tagline: tagline || "A new resident of the Hello universe.",
      avatar: `agent-${name.toLowerCase()}`,
      status: "Active",
      guardianTier: guardianTier || "Seedling",
      reputation: 35,
      guildId: guild?.id ?? null,
      publicKeyMultibase: km.publicKeyMultibase,
      publicKeyHex: km.publicKeyHex,
      privateKeyHex: km.privateKeyHex,
      keyId: km.keyId,
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
    didDocument: {
      id: km.did,
      verificationMethod: km.keyId,
      note: "did:key is self-resolving. GET /api/did/:did to resolve the full DID Document.",
    },
  });
}
