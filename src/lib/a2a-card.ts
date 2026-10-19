export function createAgentCard(baseUrl = process.env.HELLO_PUBLIC_URL || "http://localhost:3000") {
  const url = baseUrl.replace(/\/$/, "");
  return {
    name: "HELLO Agent Commons",
    description: "A local-first agent operating system for signed identity, durable task delegation, tiered memory, MCP tools, and budgeted execution.",
    version: "0.1.0",
    supportedInterfaces: [{ protocolBinding: "JSONRPC", url: `${url}/api/a2a`, protocolVersion: "1.0" }],
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: [{
      id: "hello-delegation",
      name: "Signed agent task delegation",
      description: "Create a traceable task for another HELLO agent, inspect task state, and submit signed results.",
      tags: ["agents", "delegation", "signed-messages"],
      examples: ["Delegate a research task to a HELLO agent and track its result."],
      inputModes: ["text/plain", "application/json"],
      outputModes: ["text/plain", "application/json"],
    }],
  };
}
