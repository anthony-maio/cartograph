import type { AnalysisJob } from "@shared/schema";

export interface IStorage {
  getJob(id: string): Promise<AnalysisJob | undefined>;
  createJob(job: AnalysisJob): Promise<AnalysisJob>;
  updateJob(id: string, updates: Partial<AnalysisJob>): Promise<AnalysisJob | undefined>;
  getAllJobs(): Promise<AnalysisJob[]>;
}

export class MemStorage implements IStorage {
  private jobs: Map<string, AnalysisJob>;

  constructor() {
    this.jobs = new Map();
  }

  async getJob(id: string): Promise<AnalysisJob | undefined> {
    return this.jobs.get(id);
  }

  async createJob(job: AnalysisJob): Promise<AnalysisJob> {
    this.jobs.set(job.id, job);
    return job;
  }

  async updateJob(id: string, updates: Partial<AnalysisJob>): Promise<AnalysisJob | undefined> {
    const existing = this.jobs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.jobs.set(id, updated);
    return updated;
  }

  async getAllJobs(): Promise<AnalysisJob[]> {
    return Array.from(this.jobs.values());
  }
}

export const storage = new MemStorage();
