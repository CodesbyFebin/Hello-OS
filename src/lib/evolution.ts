export const GENE_NAMES = ["reasoning", "coding", "memory", "collaboration"] as const;
export type GeneName = (typeof GENE_NAMES)[number];
export type Profile = "balanced" | GeneName;
export type Genes = Record<GeneName, number>;
export type Candidate = {
  id: string;
  genes: Genes;
  fitness: number;
  parentIds: string[];
  mutations: number;
};

export const PROFILE_TARGETS: Record<Profile, Genes> = {
  balanced: { reasoning: 0.72, coding: 0.72, memory: 0.72, collaboration: 0.72 },
  reasoning: { reasoning: 0.95, coding: 0.55, memory: 0.68, collaboration: 0.58 },
  coding: { reasoning: 0.62, coding: 0.96, memory: 0.62, collaboration: 0.56 },
  memory: { reasoning: 0.66, coding: 0.58, memory: 0.96, collaboration: 0.62 },
  collaboration: { reasoning: 0.66, coding: 0.58, memory: 0.64, collaboration: 0.96 },
};

export function isProfile(value: unknown): value is Profile {
  return typeof value === "string" && Object.hasOwn(PROFILE_TARGETS, value);
}

export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function scoreGenes(genes: Genes, profile: Profile): number {
  const target = PROFILE_TARGETS[profile];
  const error = GENE_NAMES.reduce((sum, key) => sum + (genes[key] - target[key]) ** 2, 0) / GENE_NAMES.length;
  return Math.round(Math.max(0, 100 * (1 - error)) * 100) / 100;
}

export function rankPopulation(population: Candidate[]): Candidate[] {
  return [...population].sort((a, b) => b.fitness - a.fitness || a.id.localeCompare(b.id));
}

export function summarizePopulation(population: Candidate[]) {
  const ranked = rankPopulation(population);
  const bestFitness = ranked[0]?.fitness ?? 0;
  const averageFitness = population.length
    ? Math.round((population.reduce((sum, candidate) => sum + candidate.fitness, 0) / population.length) * 100) / 100
    : 0;
  return { bestFitness, averageFitness, champion: ranked[0] ?? null };
}

export function createInitialPopulation(size: number, profile: Profile, seed: number): Candidate[] {
  const random = createRandom(seed);
  return Array.from({ length: size }, (_, index) => {
    const genes = Object.fromEntries(GENE_NAMES.map((key) => [key, Math.round(random() * 1000) / 1000])) as Genes;
    return {
      id: `g0-c${String(index + 1).padStart(2, "0")}`,
      genes,
      fitness: scoreGenes(genes, profile),
      parentIds: [],
      mutations: 0,
    };
  });
}

function tournament(population: Candidate[], random: () => number): Candidate {
  let best = population[Math.floor(random() * population.length)];
  for (let i = 1; i < 3; i += 1) {
    const challenger = population[Math.floor(random() * population.length)];
    if (challenger.fitness > best.fitness) best = challenger;
  }
  return best;
}

export function evolvePopulation(
  previous: Candidate[],
  generation: number,
  size: number,
  mutationRate: number,
  profile: Profile,
  seed: number,
): { population: Candidate[]; mutationCount: number } {
  const ranked = rankPopulation(previous);
  if (!ranked.length) throw new Error("Cannot evolve an empty population");
  const random = createRandom((seed ^ Math.imul(generation, 0x9e3779b1)) >>> 0);
  const population: Candidate[] = [];
  let mutationCount = 0;

  // Preserve the current champion so the best proxy score cannot regress.
  const elite = ranked[0];
  population.push({
    ...elite,
    id: `g${generation}-c01`,
    genes: { ...elite.genes },
    parentIds: [elite.id],
    mutations: 0,
  });

  while (population.length < size) {
    const left = tournament(ranked, random);
    const right = tournament(ranked, random);
    const genes = {} as Genes;
    let mutations = 0;
    for (const key of GENE_NAMES) {
      let value = random() < 0.5 ? left.genes[key] : right.genes[key];
      if (random() < mutationRate) {
        value = Math.max(0, Math.min(1, value + (random() * 2 - 1) * 0.25));
        mutations += 1;
      }
      genes[key] = Math.round(value * 1000) / 1000;
    }
    mutationCount += mutations;
    population.push({
      id: `g${generation}-c${String(population.length + 1).padStart(2, "0")}`,
      genes,
      fitness: scoreGenes(genes, profile),
      parentIds: [...new Set([left.id, right.id])],
      mutations,
    });
  }

  return { population, mutationCount };
}
