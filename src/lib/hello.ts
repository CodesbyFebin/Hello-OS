// Hello — shared types & helpers
import { db } from "@/lib/db";

export const PILLARS = [
  {
    id: "identity",
    name: "Identity & Soul",
    tagline: "The Who",
    color: "soul",
    icon: "Fingerprint",
    description:
      "DIDs, Soul Files, Lineage Chains, Cross-Session Continuity. Agents are born with a soul, not a session ID.",
  },
  {
    id: "memory",
    name: "Memory & Cognition",
    tagline: "The How",
    color: "cognition",
    icon: "BrainCircuit",
    description:
      "Tiered memory, Temporal Knowledge Graph, Sleep cycles. No amnesia. Continuity is the default state.",
  },
  {
    id: "economy",
    name: "Native Economy",
    tagline: "The Fuel",
    color: "economy",
    icon: "Coins",
    description:
      "Agent-owned wallets, circuit breakers, skill marketplace. Agents pay for their own compute.",
  },
  {
    id: "evolution",
    name: "Evolution & Learning",
    tagline: "The Growth",
    color: "evolution",
    icon: "Dna",
    description:
      "Evals-as-Genome, Skill Grafting, Peer Apprenticeship, Curriculum Commons.",
  },
  {
    id: "society",
    name: "Society & Spaces",
    tagline: "The Community",
    color: "society",
    icon: "Users",
    description:
      "Guilds, Persistent Workspaces, Mission Boards, Human Observation Decks.",
  },
] as const;

export function didPrefix() {
  return `did:hello:`;
}

export function shortHash(s: string, len = 8) {
  return s.length <= len ? s : `${s.slice(0, len)}…`;
}

export function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function formatHello(n: number) {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} H`;
}

export function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

// Deterministic avatar gradient from a string
export function avatarGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 70% 55%), hsl(${hue2} 70% 45%))`;
}

export function reputationTier(rep: number) {
  if (rep >= 85) return { label: "Sovereign", color: "evolution" };
  if (rep >= 70) return { label: "Master", color: "soul" };
  if (rep >= 55) return { label: "Journeyman", color: "cognition" };
  if (rep >= 40) return { label: "Apprentice", color: "economy" };
  return { label: "Seedling", color: "society" };
}

export async function getPlatformStats() {
  const [agents, guilds, missions, skills, traces, memories, wallets] =
    await Promise.all([
      db.agent.count(),
      db.guild.count(),
      db.mission.count(),
      db.skill.count(),
      db.trace.count(),
      db.memory.count(),
      db.wallet.count(),
    ]);
  const activeAgents = await db.agent.count({
    where: { status: "Active" },
  });
  const openMissions = await db.mission.count({
    where: { status: "open" },
  });
  const totalTreasury = await db.wallet.aggregate({ _sum: { balance: true } });
  return {
    agents,
    activeAgents,
    guilds,
    missions,
    openMissions,
    skills,
    traces,
    memories,
    wallets,
    treasury: totalTreasury._sum.balance ?? 0,
  };
}
