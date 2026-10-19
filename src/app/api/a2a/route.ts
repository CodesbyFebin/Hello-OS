import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signMessage, verifySignature } from "@/lib/crypto";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const error = (id: unknown, code: number, message: string) => NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

function taskView(task: { taskId: string; traceId: string; status: string; messageJson: string; resultJson: string | null; budgetCap: number; createdAt: Date; updatedAt: Date }) {
  const state = task.status === "input_required" ? "input-required" : task.status;
  return {
    id: task.taskId,
    contextId: task.traceId,
    status: { state, timestamp: task.updatedAt.toISOString() },
    history: [JSON.parse(task.messageJson)],
    ...(task.resultJson ? { artifacts: [{ parts: [{ kind: "text", text: task.resultJson }] }] } : {}),
    metadata: { budgetCap: task.budgetCap, createdAt: task.createdAt.toISOString() },
  };
}

async function sendTask(params: any) {
  const senderId = String(params.senderId || params.metadata?.senderId || "");
  const receiverId = String(params.receiverId || params.metadata?.receiverId || "");
  if (!senderId || !receiverId || !params.message) throw new Error("message/send requires senderId, receiverId, and message");
  const [sender, receiver] = await Promise.all([
    db.agent.findUnique({ where: { id: senderId } }),
    db.agent.findUnique({ where: { id: receiverId } }),
  ]);
  if (!sender || !receiver) throw new Error("sender or receiver agent not found");

  const taskId = `task_${randomUUID()}`;
  const traceId = String(params.traceId || params.message.contextId || `trc_${randomUUID()}`);
  const budgetCap = Number(params.metadata?.budgetCap ?? 0);
  if (!Number.isFinite(budgetCap) || budgetCap < 0) throw new Error("budgetCap must be non-negative");
  const messageJson = JSON.stringify(params.message);
  const intent = JSON.stringify({ taskId, traceId, senderDid: sender.did, receiverDid: receiver.did, budgetCap, message: params.message });
  const intentHash = digest(intent);
  const signature = await signMessage(intentHash, sender.privateKeyHex || "");
  const signatureValid = await verifySignature(intentHash, signature, sender.did);
  if (!signatureValid) throw new Error("sender intent signature failed verification");

  const task = await db.$transaction(async (tx) => {
    const created = await tx.a2ATask.create({ data: { taskId, senderId, receiverId, status: "submitted", messageJson, traceId, budgetCap, intentHash, signature } });
    await tx.a2AMessage.create({
      data: { senderId, receiverId, protocol: "A2A/JSON-RPC", intent: "message/send", payload: messageJson, truthTier: "verified", signed: true, signature, intentHash, traceId },
    });
    return created;
  });
  return taskView(task);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tasks = await db.a2ATask.findMany({
    where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 50,
    include: { sender: { select: { id: true, name: true, did: true } }, receiver: { select: { id: true, name: true, did: true } } },
  });
  const messages = await db.a2AMessage.findMany({
    take: 40, orderBy: { createdAt: "desc" },
    include: { sender: { select: { id: true, name: true, did: true, avatar: true } }, receiver: { select: { id: true, name: true, did: true, avatar: true } } },
  });
  return NextResponse.json({ tasks, messages });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error(null, -32700, "invalid JSON request");

  // Preserve the small legacy REST envelope for existing HELLO clients.
  if (!body.jsonrpc) {
    const { senderId, receiverId, intent, payload, truthTier } = body;
    if (!senderId || !receiverId) return NextResponse.json({ error: "sender+receiver required" }, { status: 400 });
    const message = await db.a2AMessage.create({
      data: { senderId, receiverId, intent: intent || "query", payload: typeof payload === "string" ? payload : JSON.stringify(payload || {}), truthTier: truthTier || "asserted", signed: false, traceId: `trc_${randomUUID()}` },
      include: { sender: { select: { name: true, avatar: true } }, receiver: { select: { name: true, avatar: true } } },
    });
    return NextResponse.json({ message }, { status: 201 });
  }

  const requestId = body.id;
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") return error(requestId, -32600, "invalid JSON-RPC request");
  const params = body.params || {};
  try {
    if (body.method === "message/send") {
      const result = await sendTask(params);
      return NextResponse.json({ jsonrpc: "2.0", id: requestId, result });
    }
    if (body.method === "tasks/get") {
      const task = await db.a2ATask.findUnique({ where: { taskId: String(params.id || "") } });
      if (!task) return error(requestId, -32004, "task not found");
      return NextResponse.json({ jsonrpc: "2.0", id: requestId, result: taskView(task) });
    }
    if (body.method === "tasks/cancel") {
      const task = await db.a2ATask.findUnique({ where: { taskId: String(params.id || "") } });
      if (!task) return error(requestId, -32004, "task not found");
      if (!["submitted", "working", "input_required"].includes(task.status)) return error(requestId, -32009, `cannot cancel task in ${task.status} state`);
      const canceled = await db.a2ATask.update({ where: { id: task.id }, data: { status: "canceled" } });
      return NextResponse.json({ jsonrpc: "2.0", id: requestId, result: taskView(canceled) });
    }
    if (body.method === "tasks/update") {
      const task = await db.a2ATask.findUnique({ where: { taskId: String(params.id || "") }, include: { receiver: true } });
      if (!task) return error(requestId, -32004, "task not found");
      const nextState = String(params.status || "");
      const transitions: Record<string, string[]> = { submitted: ["working", "canceled"], working: ["input_required", "completed", "failed"], input_required: ["working", "completed", "failed"] };
      if (!transitions[task.status]?.includes(nextState)) return error(requestId, -32009, `invalid transition ${task.status} → ${nextState}`);
      const resultJson = params.result === undefined ? task.resultJson : JSON.stringify(params.result);
      const signedPayload = digest(JSON.stringify({ taskId: task.taskId, traceId: task.traceId, status: nextState, result: resultJson }));
      if (!params.signature || !(await verifySignature(signedPayload, String(params.signature), task.receiver.did))) return error(requestId, -32001, "receiver signature is missing or invalid");
      const updated = await db.a2ATask.update({ where: { id: task.id }, data: { status: nextState, resultJson, intentHash: signedPayload, signature: String(params.signature) } });
      return NextResponse.json({ jsonrpc: "2.0", id: requestId, result: taskView(updated) });
    }
    if (body.method === "tasks/list") {
      const tasks = await db.a2ATask.findMany({ where: params.receiverId ? { receiverId: String(params.receiverId) } : {}, orderBy: { createdAt: "desc" }, take: Math.min(Number(params.limit || 30), 100) });
      return NextResponse.json({ jsonrpc: "2.0", id: requestId, result: { tasks: tasks.map(taskView) } });
    }
    if (body.method === "agent/card") {
      const agent = await db.agent.findUnique({ where: { id: String(params.agentId || "") } });
      if (!agent) return error(requestId, -32004, "agent not found");
      return NextResponse.json({ jsonrpc: "2.0", id: requestId, result: { name: agent.name, description: agent.tagline, url: process.env.HELLO_PUBLIC_URL || new URL(req.url).origin, did: agent.did, skills: [] } });
    }
    return error(requestId, -32601, `method not found: ${body.method}`);
  } catch (e) {
    return error(requestId, -32602, e instanceof Error ? e.message : "invalid params");
  }
}
