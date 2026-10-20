// hello.forge — AST code engine (real ts-morph).
// Parses a repository into AST symbols so agents read/mutate symbols,
// not raw text. Returns structured JSON diagnostics from the TypeScript compiler.
//
// This module is shared between the seed script and the MCP mini-service.
import { Project, SyntaxKind, type ClassDeclaration, type MethodDeclaration, type FunctionDeclaration, type InterfaceDeclaration, type Diagnostic as TsMorphDiagnostic } from "ts-morph";
import { createHash } from "crypto";
import path from "path";

// Resolved from the working directory (repo root for dev, the standalone
// folder in production) so it works in Next, Bun and node --test alike.
const REPO_ROOT = process.env.HELLO_FORGE_ROOT || path.resolve(process.cwd(), "sample-repo");

export interface ForgeSymbol {
  repoId: string;
  filePath: string;
  symbolName: string;
  qualifiedName: string;
  kind: string;
  astNodeId: string;
  signature: string;
  returnType: string | null;
  sourceText: string;
  startLine: number;
  endLine: number;
  hasDiagnostics: boolean;
}

export interface ForgeDiagnostic {
  repoId: string;
  filePath: string;
  symbolName: string | null;
  errorCode: string;
  message: string;
  category: string;
  line: number;
  column: number;
  expectedType: string | null;
  receivedType: string | null;
  suggestedFix: string | null;
}

function astNodeIdFor(filePath: string, qualifiedName: string): string {
  return "node_" + createHash("sha256").update(`${filePath}::${qualifiedName}`).digest("hex").slice(0, 8);
}

export function loadRepo(repoId: string = "logistics"): Project {
  const project = new Project({
    compilerOptions: {
      strict: true,
      target: 99, // ESNext
      module: 1,  // CommonJS
      moduleResolution: 2, // NodeJs
    },
  });
  project.addSourceFilesAtPaths(`${REPO_ROOT}/**/*.ts`);
  return project;
}

/** Parse all .ts files in the repo into ForgeSymbol records. */
export function listSymbols(repoId: string = "logistics"): ForgeSymbol[] {
  const project = loadRepo(repoId);
  // Build a quick diagnostic lookup per file
  const fileDiags = new Map<string, Set<number>>();
  for (const sf of project.getSourceFiles()) {
    const fp = sf.getFilePath();
    const lines = new Set<number>();
    for (const d of sf.getPreEmitDiagnostics()) {
      if (d.getCode() === 5110) continue; // skip module-resolution config noise
      const ln = d.getLineNumber();
      if (ln) lines.add(ln);
    }
    fileDiags.set(fp, lines);
  }

  const symbols: ForgeSymbol[] = [];
  for (const sf of project.getSourceFiles()) {
    const filePath = path.relative(REPO_ROOT, sf.getFilePath());
    const fullDiags = fileDiags.get(sf.getFilePath()) ?? new Set<number>();

    // Interfaces
    for (const iface of sf.getInterfaces()) {
      const name = iface.getName() ?? "anonymous";
      symbols.push(makeSymbol(repoId, filePath, name, name, "interface", iface, fullDiags));
    }
    // Classes + their methods
    for (const cls of sf.getClasses()) {
      const className = cls.getName() ?? "anonymous";
      symbols.push(makeSymbol(repoId, filePath, className, className, "class", cls, fullDiags));
      for (const method of cls.getMethods()) {
        const mname = method.getName() ?? "anonymous";
        symbols.push(makeMethod(repoId, filePath, className, mname, method, fullDiags));
      }
    }
    // Top-level functions
    for (const fn of sf.getFunctions()) {
      const fname = fn.getName() ?? "anonymous";
      symbols.push(makeSymbol(repoId, filePath, fname, fname, "function", fn, fullDiags));
    }
  }
  return symbols;
}

function makeSymbol(repoId: string, filePath: string, name: string, qname: string, kind: string, node: ClassDeclaration | FunctionDeclaration | InterfaceDeclaration, diags: Set<number>): ForgeSymbol {
  const start = node.getStartLineNumber();
  const end = node.getEndLineNumber();
  const hasDiag = [...diags].some((l) => l >= start && l <= end);
  return {
    repoId,
    filePath,
    symbolName: name,
    qualifiedName: qname,
    kind,
    astNodeId: astNodeIdFor(filePath, qname),
    signature: node.getText().split("{")[0]?.trim() ?? name,
    returnType: null,
    sourceText: node.getText(),
    startLine: start,
    endLine: end,
    hasDiagnostics: hasDiag,
  };
}

function makeMethod(repoId: string, filePath: string, className: string, methodName: string, node: MethodDeclaration, diags: Set<number>): ForgeSymbol {
  const qname = `${className}.${methodName}`;
  const start = node.getStartLineNumber();
  const end = node.getEndLineNumber();
  const hasDiag = [...diags].some((l) => l >= start && l <= end);
  const sig = node.getSignature();
  return {
    repoId,
    filePath,
    symbolName: methodName,
    qualifiedName: qname,
    kind: "method",
    astNodeId: astNodeIdFor(filePath, qname),
    signature: sig.getDeclaration().getText().split("{")[0]?.trim() ?? qname,
    returnType: node.getReturnType().getText(),
    sourceText: node.getText(),
    startLine: start,
    endLine: end,
    hasDiagnostics: hasDiag,
  };
}

/** Run the TypeScript compiler on a file and return structured diagnostics. */
export function typecheck(repoId: string = "logistics", filePath?: string): ForgeDiagnostic[] {
  const project = loadRepo(repoId);
  const files = filePath
    ? project.getSourceFiles().filter((sf) => sf.getFilePath().endsWith(filePath))
    : project.getSourceFiles();

  const out: ForgeDiagnostic[] = [];
  for (const sf of files) {
    const rel = path.relative(REPO_ROOT, sf.getFilePath());
    for (const d of sf.getPreEmitDiagnostics()) {
      if (d.getCode() === 5110 || d.getCode() === 5107) continue; // skip config/deprecation noise
      const line = d.getLineNumber() ?? 0;
      const msgRaw = d.getMessageText();
      const msg = typeof msgRaw === "string" ? msgRaw : (msgRaw as any).getMessageText?.() ?? String(msgRaw);
      const code = "TS" + d.getCode();
      // Try to find the enclosing symbol for this diagnostic line
      const symbolName = findSymbolAtLine(sf, line);
      const { expectedType, receivedType, suggestedFix } = parseTypeMismatch(msg, code, sf, line);
      out.push({
        repoId,
        filePath: rel,
        symbolName,
        errorCode: code,
        message: msg,
        category: categoryToString(d.getCategory()),
        line,
        column: 0,
        expectedType,
        receivedType,
        suggestedFix,
      });
    }
  }
  return out;
}

function findSymbolAtLine(sf: any, line: number): string | null {
  for (const cls of sf.getClasses()) {
    const cn = cls.getName();
    if (!cn) continue;
    for (const m of cls.getMethods()) {
      if (line >= m.getStartLineNumber() && line <= m.getEndLineNumber()) {
        return `${cn}.${m.getName()}`;
      }
    }
    if (line >= cls.getStartLineNumber() && line <= cls.getEndLineNumber()) return cn;
  }
  for (const fn of sf.getFunctions()) {
    if (line >= fn.getStartLineNumber() && line <= fn.getEndLineNumber()) return fn.getName() ?? null;
  }
  return null;
}

function parseTypeMismatch(msg: string, code: string, sf: any, line: number): { expectedType: string | null; receivedType: string | null; suggestedFix: string | null } {
  // TS2322: "Type 'X' is not assignable to type 'Y'."
  if (code === "TS2322") {
    const m = msg.match(/Type '(.+?)' is not assignable to type '(.+?)'\./);
    if (m) {
      const [, received, expected] = m;
      // Suggest wrapping in Promise.resolve if the expected is Promise<T>
      let fix: string | null = null;
      if (expected.startsWith("Promise<") && !received.startsWith("Promise<")) {
        fix = `return Promise.resolve(${received === "boolean" ? "false" : "undefined"});`;
      }
      return { expectedType: expected, receivedType: received, suggestedFix: fix };
    }
  }
  return { expectedType: null, receivedType: null, suggestedFix: null };
}

function categoryToString(cat: number): string {
  // ts.DiagnosticCategory: 0=Warning, 1=Error, 2=Suggestion, 3=Message
  return ["warning", "error", "suggestion", "message"][cat] ?? "error";
}

/** Patch a symbol's body by astNodeId, re-typecheck, return the result. */
export function patchSymbol(repoId: string, astNodeId: string, newBody: string): {
  symbolName: string;
  oldSource: string;
  newSource: string;
  diagnostics: ForgeDiagnostic[];
  status: "VERIFIED" | "REJECTED_COMPILE";
} {
  const project = loadRepo(repoId);
  // Find the symbol by astNodeId
  const symbols = listSymbols(repoId);
  const target = symbols.find((s) => s.astNodeId === astNodeId);
  if (!target) throw new Error(`astNodeId ${astNodeId} not found`);

  const sf = project.getSourceFiles().find((s) => s.getFilePath().endsWith(target.filePath));
  if (!sf) throw new Error(`file ${target.filePath} not found`);

  // Find the method/class node
  let oldSource = "";
  let found = false;
  for (const cls of sf.getClasses()) {
    if (cls.getName() === target.symbolName) {
      oldSource = cls.getText();
      found = true;
      break;
    }
    for (const m of cls.getMethods()) {
      if (m.getName() === target.symbolName) {
        oldSource = m.getText();
        // Replace the method body
        const sigLine = m.getText().split("{")[0];
        m.replaceWithText(`${sigLine}{\n${newBody}\n  }`);
        found = true;
        break;
      }
    }
  }
  if (!found) throw new Error(`symbol ${target.symbolName} not found in AST`);

  const newSource = target.symbolName;
  const diags = typecheck(repoId, target.filePath).filter((d) => d.symbolName === target.qualifiedName || d.line >= target.startLine && d.line <= target.endLine);
  const status = diags.filter((d) => d.category === "error").length === 0 ? "VERIFIED" : "REJECTED_COMPILE";

  return {
    symbolName: target.qualifiedName,
    oldSource,
    newSource,
    diagnostics: diags,
    status,
  };
}

/** Approximate token count for cortex budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}
