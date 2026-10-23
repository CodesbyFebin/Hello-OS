// Hello — real cryptographic identity (did:key + Ed25519)
// Spec: https://w3c-ccg.github.io/did-method-key/
// did:key is self-resolving — no registry needed on day one.
// The DID identifier IS the encoded public key.

import * as ed from "@noble/ed25519";
import { base58 as base58btc } from "@scure/base";

// Multicodec for Ed25519 public key (per the multikey spec)
// https://github.com/multiformats/multicodec/blob/master/table.md
const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

export interface KeyMaterial {
  did: string;                   // did:key:z...
  publicKeyMultibase: string;    // z... (the multikey, base58btc)
  publicKeyHex: string;          // 32-byte hex
  privateKeyHex: string;         // 32-byte seed hex — held by the agent's wallet/custodian
  keyId: string;                 // did:key:z...#z...
}

/**
 * Generate a fresh Ed25519 keypair and derive the did:key identifier.
 * The DID is deterministic from the public key — no registry, no round-trip.
 */
export async function generateDidKey(): Promise<KeyMaterial> {
  const seed = ed.utils.randomSecretKey(); // 32-byte seed
  const publicKey = await ed.getPublicKeyAsync(seed); // 32-byte public key

  // Multikey = multicodec prefix (0xed01) + raw public key (32 bytes)
  const multikey = new Uint8Array(ED25519_MULTICODEC.length + publicKey.length);
  multikey.set(ED25519_MULTICODEC, 0);
  multikey.set(publicKey, ED25519_MULTICODEC.length);

  const publicKeyMultibase = "z" + base58btc.encode(multikey);
  const did = `did:key:${publicKeyMultibase}`;
  const keyId = `${did}#${publicKeyMultibase}`;

  return {
    did,
    publicKeyMultibase,
    publicKeyHex: bytesToHex(publicKey),
    privateKeyHex: bytesToHex(seed),
    keyId,
  };
}

/**
 * Resolve a did:key identifier into a spec-shaped DID Document.
 * This is the resolution function — given a did:key, return the verifiable
 * DID Document with the verification method and service endpoints.
 */
export function resolveDidKey(did: string): {
  document: any;
  publicKeyHex: string;
} | null {
  if (!did.startsWith("did:key:")) return null;
  const multibase = did.slice("did:key:".length);
  if (!multibase.startsWith("z")) return null;

  let multikey: Uint8Array;
  try {
    multikey = base58btc.decode(multibase.slice(1));
  } catch {
    return null;
  }
  if (multikey.length < 2 || multikey[0] !== 0xed || multikey[1] !== 0x01) return null;
  const publicKey = multikey.slice(2);
  if (publicKey.length !== 32) return null;
  const publicKeyHex = bytesToHex(publicKey);
  const keyId = `${did}#${multibase}`;

  // Spec-shaped DID Document per the did:key method spec
  const document = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1",
    ],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: "Ed25519VerificationKey2020",
        controller: did,
        publicKeyMultibase: multibase,
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    capabilityInvocation: [keyId],
    capabilityDelegation: [keyId],
    // Service endpoints — where the agent speaks MCP+A2A
    service: [
      {
        id: `${did}#mcp`,
        type: "MCP-Server",
        serviceEndpoint: `/api/did/${encodeURIComponent(did)}/mcp`,
      },
      {
        id: `${did}#a2a`,
        type: "A2A-Agent-Card",
        serviceEndpoint: `/api/did/${encodeURIComponent(did)}/a2a`,
      },
    ],
  };

  return { document, publicKeyHex };
}

/**
 * Sign a message with the agent's Ed25519 private key.
 * Returns a hex signature. This is real Intent Signing (#41).
 */
export async function signMessage(message: string, privateKeyHex: string): Promise<string> {
  const seed = hexToBytes(privateKeyHex);
  const sig = await ed.signAsync(utf8ToBytes(message), seed);
  return bytesToHex(sig);
}

/**
 * Verify a signature against the agent's did:key public key.
 * Resolves did:key → public key → verifies. Makes Consent Envelopes (#7) true.
 */
export async function verifySignature(
  message: string,
  signatureHex: string,
  did: string
): Promise<boolean> {
  const resolved = resolveDidKey(did);
  if (!resolved) return false;
  try {
    const sig = hexToBytes(signatureHex);
    const msg = utf8ToBytes(message);
    return await ed.verifyAsync(sig, msg, hexToBytes(resolved.publicKeyHex));
  } catch {
    return false;
  }
}

/**
 * Construct a canonical intent message for signing.
 * Canonicalization lets a verifier rebuild this exact string, so a signature check detects any change to these fields.
 */
export function canonicalIntent(payload: Record<string, string | number>): string {
  const keys = Object.keys(payload).sort();
  return keys.map((k) => `${k}=${payload[k]}`).join("&");
}

// --- byte helpers ---
function bytesToHex(b: Uint8Array): string {
  let h = "";
  for (let i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, "0");
  return h;
}
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
