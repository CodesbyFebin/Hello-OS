"use client";

import * as React from "react";

const MAX_LEN = 4000;
const SAMPLE = `mission triage_bug {
  input: $issue_id
  budget: 5 credits
  steps {
    fetch: github.issue($issue_id) → $issue
    classify: llm.label($issue) → $label
    emit: triage_receipt
  }
}`;

type Graph = { id: string; declaration: string; operation: string; source: string; line: number };
type Compiled = { ok: boolean; ast: { kind: string; name: string; body: { kind: string; raw: string }[] }[]; graph: Graph[]; lexicalTokenCount: number; diagnostics: { severity: string; message: string; line: number }[]; sourceSha256: string };
type Receipt = { step: string; sha256: string; signature: string | null };

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));
const enc = (s: string) => new TextEncoder().encode(s);

export function AmlPreview() {
  const [src, setSrc] = React.useState(SAMPLE);
  const [res, setRes] = React.useState<Compiled | null>(null);
  const [receipts, setReceipts] = React.useState<Receipt[]>([]);
  const [keyInfo, setKeyInfo] = React.useState<{ pair: CryptoKeyPair | null; pub: string; note: string }>({ pair: null, pub: "", note: "" });
  const [verify, setVerify] = React.useState<string>("");
  const [err, setErr] = React.useState("");

  async function compile() {
    setErr(""); setVerify("");
    try {
      const r = await fetch("/api/aml/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: src.slice(0, MAX_LEN) }) });
      const c = (await r.json()) as Compiled & { error?: string };
      if (c.error) throw new Error(c.error);
      setRes(c);
      let pair: CryptoKeyPair | null = null; let pub = ""; let note = "";
      try {
        pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
        pub = hex(await crypto.subtle.exportKey("raw", pair.publicKey));
      } catch { note = "This browser does not support Ed25519 in Web Crypto; receipts are unsigned."; }
      setKeyInfo({ pair, pub, note });
      const out: Receipt[] = [];
      for (const g of c.graph ?? []) {
        const payload = JSON.stringify({ step: g.id, op: g.operation, source: g.source, program: c.sourceSha256 });
        const sha = hex(await crypto.subtle.digest("SHA-256", enc(payload)));
        const sig = pair ? hex(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, enc(sha))) : null;
        out.push({ step: `${g.id} · ${g.operation}`, sha256: sha, signature: sig });
      }
      setReceipts(out);
    } catch (e) { setErr(e instanceof Error ? e.message : "compile failed"); setRes(null); setReceipts([]); }
  }

  async function verifyAll(tamper = false) {
    if (!keyInfo.pair) { setVerify("Nothing to verify: receipts are unsigned."); return; }
    let ok = 0;
    for (const [i, r] of receipts.entries()) {
      const msg = tamper && i === 0 ? r.sha256.replace(/^./, (c) => (c === "0" ? "1" : "0")) : r.sha256;
      if (r.signature && (await crypto.subtle.verify({ name: "Ed25519" }, keyInfo.pair.publicKey, unhex(r.signature), enc(msg)))) ok++;
    }
    setVerify(`${ok}/${receipts.length} signatures valid${tamper ? " (first hash deliberately altered, so it should fail)" : ""}`);
  }

  // Compile the sample once on load so the preview isn't empty.
  React.useEffect(() => { const t = window.setTimeout(() => { void compile(); }, 0); return () => window.clearTimeout(t); }, []);

  const intent = res?.ast?.[0];
  const params = intent?.body?.filter((b) => b.kind === "statement" && /^[a-z_]+\s*:/i.test(b.raw)).map((b) => b.raw) ?? [];

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-heading"><div><div className="panel-kicker">AML · STATIC COMPILE PREVIEW</div><h2>Compile &amp; sign receipts <span className="panel-count">not executed</span></h2></div><a className="panel-link" href="/aml-studio">Open AML Studio</a></div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", padding: "0 4px 8px" }}>
        <div>
          <textarea aria-label="AML source" value={src} maxLength={MAX_LEN} onChange={(e) => setSrc(e.target.value.slice(0, MAX_LEN))} rows={11} style={{ width: "100%", fontFamily: "monospace", fontSize: 12, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 8 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11 }}><button className="button-primary" onClick={compile}>Compile</button><span style={{ opacity: 0.6 }}>{src.length}/{MAX_LEN} chars · uses this repo&apos;s compiler at /api/aml/compile</span></div>
          {err && <p style={{ color: "#fca5a5", fontSize: 12 }}>{err}</p>}
        </div>
        <div style={{ fontSize: 12 }}>
          {res && <>
            <div><b>Intent:</b> {intent ? `${intent.kind} ${intent.name}` : "—"}</div>
            <div><b>Params:</b> {params.length ? params.join(" · ") : "—"}</div>
            <div><b>Simple lexer token count:</b> {res.lexicalTokenCount}</div>
            {res.diagnostics?.length > 0 && <div style={{ color: "#fcd34d" }}>{res.diagnostics.map((d, i) => <div key={i}>L{d.line} {d.severity}: {d.message}</div>)}</div>}
            <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 10, color: "#fcd34d" }}>{keyInfo.pair ? `DEMO KEY · NOT PERSISTED · ed25519 pub ${keyInfo.pub.slice(0, 16)}…` : `UNSIGNED · ${keyInfo.note}`}</div>
            <ol style={{ marginTop: 4, fontFamily: "monospace", fontSize: 10.5, paddingLeft: 16 }}>{receipts.map((r) => <li key={r.step}>{r.step}<br /><span style={{ opacity: 0.65 }}>sha256 {r.sha256.slice(0, 24)}… · sig {r.signature ? `${r.signature.slice(0, 16)}…` : "unsigned"}</span></li>)}</ol>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}><button className="button-secondary" onClick={() => verifyAll(false)} disabled={!receipts.length}>Verify</button><button className="button-secondary" onClick={() => verifyAll(true)} disabled={!receipts.length}>Verify with tampered hash</button></div>
            {verify && <div style={{ marginTop: 4 }}>{verify}</div>}
          </>}
        </div>
      </div>
    </section>
  );
}
