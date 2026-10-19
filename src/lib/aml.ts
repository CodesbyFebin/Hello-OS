import { createHash } from "node:crypto";

export type AmlConstruct = "intent" | "capability" | "mission" | "memory" | "wallet" | "swarm" | "governance" | "agent" | "model_matrix" | "bridge";

export interface AmlDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  line: number;
  column: number;
}

export interface AmlNode {
  kind: AmlConstruct | "block" | "statement";
  name: string;
  header: string;
  raw: string;
  line: number;
  body: AmlNode[];
}

export interface AmlGraphNode {
  id: string;
  declaration: string;
  operation: string;
  source: string;
  line: number;
}

export interface AmlCompilation {
  ok: boolean;
  executable: false;
  version: "aml-static-v1";
  ast: AmlNode[];
  graph: AmlGraphNode[];
  requiredCapabilities: string[];
  budgets: Array<{ declaration: string; amount: number; unit: string }>;
  sourceSha256: string;
  graphSha256: string;
  lexicalTokenCount: number;
  tokenMetrics: {
    amlTokens: number;
    estimatedJsonTokens: number;
    estimatedPythonTokens: number;
    tokenReductionPct: number;
    tokenizer: "aml-lexical-v1";
  };
  diagnostics: AmlDiagnostic[];
}

type TokenKind = "word" | "variable" | "string" | "number" | "symbol" | "newline" | "eof";
interface Token { kind: TokenKind; value: string; start: number; end: number; line: number; column: number }
const CONSTRUCTS = new Set<AmlConstruct>(["intent", "capability", "mission", "memory", "wallet", "swarm", "governance", "agent", "model_matrix", "bridge"]);
const MAX_SOURCE_LENGTH = 64_000;
const MAX_TOKEN_COUNT = 20_000;
const MAX_NESTING = 32;

class AmlParser {
  private cursor = 0;
  private readonly source: string;
  readonly diagnostics: AmlDiagnostic[] = [];
  readonly tokens: Token[];

  constructor(source: string) {
    this.source = source;
    this.tokens = tokenize(source, this.diagnostics);
  }

  parse(): AmlNode[] {
    const declarations: AmlNode[] = [];
    const names = new Set<string>();
    while (!this.at("eof")) {
      this.skipSeparators();
      if (this.at("eof")) break;
      const start = this.peek();
      const keyword = this.take();
      if (keyword.kind !== "word" || !CONSTRUCTS.has(keyword.value as AmlConstruct)) {
        this.error("AML001", `Expected a top-level AML declaration; found '${keyword.value}'.`, keyword);
        this.skipLine();
        continue;
      }
      const kind = keyword.value as AmlConstruct;
      const headerStart = this.peek();
      const headerTokens: Token[] = [];
      while (!this.at("eof") && !this.isSymbol("{") && !this.isSymbol("}")) {
        if (!this.at("newline")) headerTokens.push(this.take());
        else this.take();
      }
      if (!this.isSymbol("{")) {
        this.error("AML002", `Declaration '${kind}' must have a braced body.`, this.peek());
        this.skipLine();
        continue;
      }
      const open = this.take();
      const header = this.source.slice(headerStart.start, open.start).trim();
      const name = kind === "wallet" && !header ? "wallet" : firstIdentifier(header);
      if (!name) this.error("AML003", `Declaration '${kind}' requires a name.`, keyword);
      const declarationName = name || `${kind}_${keyword.line}`;
      const key = `${kind}:${declarationName}`;
      if (names.has(key)) this.error("AML004", `Duplicate ${kind} declaration '${declarationName}'.`, keyword);
      names.add(key);
      const body = this.parseBlock(1);
      const end = this.previous();
      declarations.push({
        kind,
        name: declarationName,
        header,
        raw: this.source.slice(start.start, end.end),
        line: keyword.line,
        body,
      });
    }
    return declarations;
  }

  private parseBlock(depth: number): AmlNode[] {
    const body: AmlNode[] = [];
    if (depth > MAX_NESTING) {
      this.error("AML005", `Maximum block nesting (${MAX_NESTING}) exceeded.`, this.peek());
      this.skipBalancedBlock();
      return body;
    }
    while (!this.at("eof") && !this.isSymbol("}")) {
      this.skipSeparators();
      if (this.at("eof") || this.isSymbol("}")) break;
      const start = this.peek();
      const headerTokens: Token[] = [];
      while (!this.at("eof") && !this.at("newline") && !this.isSymbol("}") && !this.isSymbol("{")) {
        headerTokens.push(this.take());
      }
      const header = headerTokens.map((t) => t.value).join(" ").trim();
      if (this.isSymbol("{")) {
        const open = this.take();
        const children = this.parseBlock(depth + 1);
        const end = this.previous();
        body.push({ kind: "block", name: firstIdentifier(header) || "block", header, raw: this.source.slice(start.start, end.end), line: start.line, body: children });
        if (this.at("newline")) this.take();
        continue;
      }
      if (headerTokens.length) {
        const end = this.previous();
        body.push({ kind: "statement", name: firstIdentifier(header) || "statement", header, raw: this.source.slice(start.start, end.end), line: start.line, body: [] });
      }
      if (this.at("newline") || this.isSymbol(";")) this.take();
    }
    if (this.isSymbol("}")) this.take();
    else this.error("AML006", "Unclosed declaration body.", this.peek());
    return body;
  }

  private skipBalancedBlock() {
    let depth = 0;
    while (!this.at("eof")) {
      if (this.isSymbol("{")) depth++;
      if (this.isSymbol("}")) {
        depth--;
        this.take();
        if (depth <= 0) return;
        continue;
      }
      this.take();
    }
  }
  private skipSeparators() { while (this.at("newline") || this.isSymbol(";")) this.take(); }
  private skipLine() { while (!this.at("eof") && !this.at("newline")) this.take(); }
  private error(code: string, message: string, token: Token) { this.diagnostics.push({ severity: "error", code, message, line: token.line, column: token.column }); }
  private peek() { return this.tokens[this.cursor] ?? this.tokens[this.tokens.length - 1]; }
  private previous() { return this.tokens[Math.max(0, this.cursor - 1)] ?? this.peek(); }
  private take() { const token = this.peek(); if (token.kind !== "eof") this.cursor++; return token; }
  private at(kind: TokenKind) { return this.peek().kind === kind; }
  private isSymbol(symbol: string) { return this.peek().kind === "symbol" && this.peek().value === symbol; }
}

function tokenize(source: string, diagnostics: AmlDiagnostic[]): Token[] {
  const out: Token[] = [];
  let i = 0, line = 1, column = 1;
  const push = (kind: TokenKind, start: number, end: number, tokenLine: number, tokenColumn: number) => {
    out.push({ kind, value: source.slice(start, end), start, end, line: tokenLine, column: tokenColumn });
  };
  while (i < source.length && out.length < MAX_TOKEN_COUNT) {
    const char = source[i];
    if (char === " " || char === "\t" || char === "\r") { i++; column++; continue; }
    if (char === "\n") { push("newline", i, i + 1, line, column); i++; line++; column = 1; continue; }
    if (char === "/" && source[i + 1] === "/") { while (i < source.length && source[i] !== "\n") { i++; column++; } continue; }
    if (char === "#") { while (i < source.length && source[i] !== "\n") { i++; column++; } continue; }
    const start = i, tokenLine = line, tokenColumn = column;
    if (char === '"' || char === "'") {
      const quote = char; i++; column++; let closed = false;
      while (i < source.length) {
        if (source[i] === "\\") { i += Math.min(2, source.length - i); column += 2; continue; }
        if (source[i] === quote) { i++; column++; closed = true; break; }
        if (source[i] === "\n") { line++; column = 1; i++; continue; }
        i++; column++;
      }
      push("string", start, i, tokenLine, tokenColumn);
      if (!closed) diagnostics.push({ severity: "error", code: "AML007", message: "Unterminated string literal.", line: tokenLine, column: tokenColumn });
      continue;
    }
    if (char === "$" && /[A-Za-z_]/.test(source[i + 1] || "")) {
      i++; column++;
      while (i < source.length && /[A-Za-z0-9_.-]/.test(source[i])) { i++; column++; }
      push("variable", start, i, tokenLine, tokenColumn); continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      while (i < source.length && /[A-Za-z0-9_.-]/.test(source[i])) { i++; column++; }
      push("word", start, i, tokenLine, tokenColumn); continue;
    }
    if (/[0-9]/.test(char)) {
      while (i < source.length && /[0-9.]/.test(source[i])) { i++; column++; }
      push("number", start, i, tokenLine, tokenColumn); continue;
    }
    const two = source.slice(i, i + 2);
    if (["->", "<-", ">=", "<=", "==", "!=", "=>"].includes(two)) { i += 2; column += 2; push("symbol", start, i, tokenLine, tokenColumn); continue; }
    if (char === "→" || char === "←") { i++; column++; push("symbol", start, i, tokenLine, tokenColumn); continue; }
    if ("{}()[]:,.<>+-*/=!@;".includes(char)) { i++; column++; push("symbol", start, i, tokenLine, tokenColumn); continue; }
    diagnostics.push({ severity: "error", code: "AML008", message: `Unexpected character '${char}'.`, line, column });
    i++; column++;
  }
  if (i < source.length) diagnostics.push({ severity: "error", code: "AML009", message: `Token limit (${MAX_TOKEN_COUNT}) exceeded.`, line, column });
  out.push({ kind: "eof", value: "", start: source.length, end: source.length, line, column });
  return out;
}

function firstIdentifier(value: string): string | null {
  return value.match(/[A-Za-z_][A-Za-z0-9_.-]*/)?.[0] ?? null;
}

function flatten(nodes: AmlNode[]): AmlNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.body)]);
}

function isExecutableStatement(statement: string): boolean {
  const trimmed = statement.trim();
  if (!trimmed || /^(input|budget|deadline|goal|requires|topic|confidence|source|when|version|role|name|guardianTier|autonomySpendCapUsd)\s*:/.test(trimmed)) return false;
  return /(?:→|←|->|<-|\b(?:emit|retry|rollback|persist|verify|lock_escrow|release_escrow)\b|\b[A-Za-z_][\w.-]*\s*\()/.test(trimmed);
}

function requiredNames(nodes: AmlNode[]): string[] {
  const result = new Set<string>();
  for (const node of flatten(nodes)) {
    if (node.kind !== "statement" || !/^requires\s*:/.test(node.header)) continue;
    const list = node.header.match(/\[([^\]]*)\]/)?.[1] ?? node.header.replace(/^requires\s*:\s*/, "");
    for (const item of list.split(",").map((part) => part.trim()).filter(Boolean)) result.add(item);
  }
  return [...result];
}

function callTargets(statement: string): string[] {
  // Operation labels (e.g. `build: tool(...)`) and direct calls are both accepted.
  const operation = statement.replace(/^\s*[A-Za-z_][\w.-]*\s*:\s*/, "");
  return [...operation.matchAll(/\b([A-Za-z_][\w.-]*)\s*\(/g)].map((match) => match[1]);
}

function findFlowCalls(nodes: AmlNode[], insideFlow = false): Array<{ node: AmlNode; target: string }> {
  const calls: Array<{ node: AmlNode; target: string }> = [];
  for (const node of nodes) {
    const inFlow = insideFlow || (node.kind === "block" && node.name === "flow");
    if (node.kind === "statement" && inFlow) {
      for (const target of callTargets(node.header)) calls.push({ node, target });
    }
    if (node.body.length) calls.push(...findFlowCalls(node.body, inFlow));
  }
  return calls;
}

function approximateTokens(text: string): number {
  // Deterministic lexical estimate only; model vendors use different tokenizers.
  return text.match(/[A-Za-z_][A-Za-z0-9_.-]*|\d+(?:\.\d+)?|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s]/g)?.length ?? 0;
}

export function compileAml(source: string): AmlCompilation {
  const diagnostics: AmlDiagnostic[] = [];
  const input = typeof source === "string" ? source : "";
  if (input.length > MAX_SOURCE_LENGTH) {
    diagnostics.push({ severity: "error", code: "AML010", message: `Source exceeds ${MAX_SOURCE_LENGTH} characters.`, line: 1, column: 1 });
  }
  const parser = new AmlParser(input.slice(0, MAX_SOURCE_LENGTH));
  const ast = parser.parse();
  diagnostics.push(...parser.diagnostics);
  if (ast.length === 0 && input.trim()) diagnostics.push({ severity: "error", code: "AML011", message: "No valid AML declarations were found.", line: 1, column: 1 });

  const graph: AmlGraphNode[] = [];
  const budgets: AmlCompilation["budgets"] = [];
  const requiredCapabilities = new Set<string>();
  for (const declaration of ast) {
    for (const requirement of requiredNames(declaration.body)) requiredCapabilities.add(requirement);
    for (const node of flatten(declaration.body)) {
      if (node.kind !== "statement") continue;
      const budget = node.header.match(/^budget\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)?\s*$/);
      if (/^budget\s*:/.test(node.header) && !budget) {
        diagnostics.push({ severity: "error", code: "AML012", message: "Budget must be a non-negative number with an optional unit.", line: node.line, column: 1 });
      } else if (budget) {
        const amount = Number(budget[1]);
        if (!Number.isFinite(amount)) diagnostics.push({ severity: "error", code: "AML013", message: "Budget must be finite.", line: node.line, column: 1 });
        else budgets.push({ declaration: declaration.name, amount, unit: (budget[2] || "unspecified").toUpperCase() });
      }
      if (isExecutableStatement(node.header)) {
        graph.push({ id: `step_${graph.length + 1}`, declaration: declaration.name, operation: node.name, source: node.header, line: node.line });
      }
    }
    if (declaration.kind === "capability") {
      const allowed = new Set([...requiredNames(declaration.body), "emit", "retry", "rollback"]);
      for (const { node, target } of findFlowCalls(declaration.body)) {
        if (!allowed.has(target)) diagnostics.push({ severity: "error", code: "AML014", message: `Flow calls '${target}', but it is not listed in this capability's requires block.`, line: node.line, column: 1 });
      }
    }
  }

  const graphData = JSON.stringify(graph.map(({ id, declaration, operation, source, line }) => ({ id, declaration, operation, source, line })));
  const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
  const amlTokens = parser.tokens.filter((token) => token.kind !== "eof" && token.kind !== "newline").length;
  const canonicalAst = JSON.stringify(ast);
  const pythonProjection = ast.map((node) => `${node.kind}(${JSON.stringify(node.name)}, ${JSON.stringify(node.header)}, ${node.body.map((child) => JSON.stringify(child.header)).join(", ")})`).join("\n");
  const estimatedJsonTokens = approximateTokens(canonicalAst);
  const estimatedPythonTokens = approximateTokens(pythonProjection);
  return {
    ok: diagnostics.every((item) => item.severity !== "error"),
    executable: false,
    version: "aml-static-v1",
    ast,
    graph,
    requiredCapabilities: [...requiredCapabilities].sort(),
    budgets,
    sourceSha256: hash(input),
    graphSha256: hash(graphData),
    lexicalTokenCount: amlTokens,
    tokenMetrics: {
      amlTokens,
      estimatedJsonTokens,
      estimatedPythonTokens,
      tokenReductionPct: estimatedPythonTokens ? Number(((1 - amlTokens / estimatedPythonTokens) * 100).toFixed(1)) : 0,
      tokenizer: "aml-lexical-v1",
    },
    diagnostics,
  };
}
