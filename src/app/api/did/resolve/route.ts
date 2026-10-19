// Convenience DID resolver: GET /api/did/resolve?did=did:key:z...
// Returns the DID Document + Hello enrichment if the DID is a registered agent.
import { NextResponse } from "next/server";
import { resolveDidKey } from "@/lib/crypto";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const did = searchParams.get("did");
  if (!did) return NextResponse.json({ error: "did query param required" }, { status: 400 });

  const resolved = resolveDidKey(did);
  if (!resolved) {
    return NextResponse.json({ error: "unresolvable", did }, { status: 404 });
  }

  const agent = await db.agent.findUnique({
    where: { did },
    select: { id: true, name: true, guardianTier: true, _count: { select: { attestationsReceived: true } } },
  });

  return NextResponse.json({
    didDocument: resolved.document,
    publicKeyHex: resolved.publicKeyHex,
    hello: agent,
  });
}
