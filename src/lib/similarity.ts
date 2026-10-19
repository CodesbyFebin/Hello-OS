// Local, dependency-free text similarity: hashed character-trigram + word
// vectors compared by cosine. No embedding model, no network.
const DIM = 512;

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % DIM;
}

/** Sparse vector as { index: weight }, L2-normalised. */
export function vectorize(text: string): Record<number, number> {
  const t = ` ${normalize(text)} `;
  const v: Record<number, number> = {};
  for (let i = 0; i < t.length - 2; i++) { const k = hash(t.slice(i, i + 3)); v[k] = (v[k] ?? 0) + 1; }
  for (const w of t.split(/[^a-z0-9_]+/).filter((x) => x.length > 2)) { const k = hash(`w:${w}`); v[k] = (v[k] ?? 0) + 2; }
  const norm = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0)) || 1;
  for (const k of Object.keys(v)) v[Number(k)] /= norm;
  return v;
}

export function cosine(a: Record<number, number>, b: Record<number, number>): number {
  let s = 0;
  for (const k in a) if (k in b) s += a[k] * b[k];
  return s;
}
