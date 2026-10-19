// hello.forge sample repository — autonomous-logistics-engine
// This is a real TypeScript codebase that hello.forge parses into AST symbols.
// scheduler.ts intentionally contains a type error (TS2322) so the diagnostic
// engine can demonstrate structured JSON failure output.

export interface DueJob {
  id: string;
  scheduledAt: number;
  payload: unknown;
  priority: "low" | "normal" | "high";
}

export interface JobResult {
  jobId: string;
  success: boolean;
  durationMs: number;
}

/**
 * DurableJobScheduler — processes due jobs from a priority queue.
 * Persists state to survive microVM restarts.
 */
export class DurableJobScheduler {
  private queue: DueJob[] = [];
  private processing: boolean = false;

  /**
   * Dequeue and process the next due job.
   * INTENTIONAL TYPE ERROR: declared Promise<boolean> but returns bare boolean.
   * hello.forge diagnostic engine catches this as TS2322.
   */
  processNextDueJob(): Promise<boolean> {
    const job = this.queue.shift();
    if (!job) return false;
    this.execute(job);
    return true;
  }

  enqueue(job: DueJob): void {
    this.queue.push(job);
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        const order = { high: 0, normal: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      return a.scheduledAt - b.scheduledAt;
    });
  }

  async execute(job: DueJob): Promise<JobResult> {
    const t0 = Date.now();
    try {
      console.log(`[scheduler] executing job ${job.id}`);
      return { jobId: job.id, success: true, durationMs: Date.now() - t0 };
    } catch (e) {
      return { jobId: job.id, success: false, durationMs: Date.now() - t0 };
    }
  }

  pendingCount(): number {
    return this.queue.length;
  }
}
