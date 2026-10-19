// Technique 17: schema version fingerprinting. A SHA-256 over a canonical
// (sorted) JSON form of the reflected schema. Identifier only — not a signature.
import { createHash } from "node:crypto";

interface Col { name: string; type: string; nullable: boolean; primaryKey: boolean }
interface Table { name: string; columns: Col[] }

export function canonicalSchema(tables: Table[]): string {
  const norm = [...tables]
    .map((t) => ({ name: t.name, columns: [...t.columns].sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.name, c.type.toUpperCase(), c.nullable, c.primaryKey]) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify(norm);
}

export function schemaFingerprint(tables: Table[]) {
  const canonical = canonicalSchema(tables);
  return { algorithm: "sha256", fingerprint: createHash("sha256").update(canonical).digest("hex"), tableCount: tables.length, canonicalBytes: Buffer.byteLength(canonical) };
}

/** Compare against an expected fingerprint and list table-level differences. */
export function diffSchemas(before: Table[], after: Table[]) {
  const key = (t: Table) => canonicalSchema([t]);
  const a = new Map(before.map((t) => [t.name, key(t)]));
  const b = new Map(after.map((t) => [t.name, key(t)]));
  return {
    added: [...b.keys()].filter((k) => !a.has(k)),
    removed: [...a.keys()].filter((k) => !b.has(k)),
    changed: [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k)),
  };
}
