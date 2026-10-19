// DID resolution: did:key → spec-shaped DID Document.
// did:key is self-resolving — the identifier IS the encoded public key,
// so resolution is a pure function, no registry lookup.
//
// Example: GET /api/did/did:key:z6Mk...  →  DID Document
import { NextResponse } from "next/server";
import { resolveDidKey } from "@/lib/crypto";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ did: string }> }) {
  let { did } = await params;
  // The DID may arrive URL-encoded; decode it.
  did = decodeURIComponent(did);

  const resolved = resolveDidKey(did);
  if (!resolved) {
    return NextResponse.json(
      { error: "unresolvable DID", did, reason: "Not a valid did:key identifier" },
      { status: 404 }
    );
  }

  // Look up whether this DID is a registered Hello agent (enriches the doc)
  const agent = await db.agent.findUnique({
    where: { did },
    select: {
      id: true, name: true, tagline: true, guardianTier: true, status: true,
      guild: { select: { name: true, slug: true } },
      _count: { select: { attestationsReceived: true } },
    },
  });

  return NextResponse.json({
    "@context": "https://w3id.org/did-resolution/v1",
    didDocument: resolved.document,
    didDocumentMetadata: {
      produced: new Date().toISOString(),
      method: "did:key",
      // Hello-specific enrichment (not part of the DID spec, but useful)
      hello: agent
        ? {
            registered: true,
            agentId: agent.id,
            name: agent.name,
            guardianTier: agent.guardianTier,
            guild: agent.guild?.name ?? null,
            attestations: agent._count.attestationsReceived,
          }
        : { registered: false },
    },
  });
}
