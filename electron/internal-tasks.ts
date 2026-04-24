import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FramePaths } from './paths.js';

export type InternalTaskStatus = 'pending' | 'in-progress' | 'done';

export interface InternalTask {
  id: string;
  title: string;
  status: InternalTaskStatus;
  createdAt: number;
  updatedAt: number;
  notes?: string;
  order: number;
}

type Event =
  | { kind: 'add'; task: InternalTask }
  | { kind: 'update'; id: string; patch: Partial<Omit<InternalTask, 'id' | 'createdAt'>> }
  | { kind: 'remove'; id: string };

export class InternalTasksStore {
  private logPath = '';
  private tasks = new Map<string, InternalTask>();
  private nextOrder = 0;

  async init(): Promise<void> {
    const paths = FramePaths.all();
    this.logPath = path.join(paths.data, 'internal-tasks.jsonl');
    try {
      const raw = await fs.readFile(this.logPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try { this.applyEvent(JSON.parse(line) as Event); } catch { /* skip corrupt */ }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    for (const t of this.tasks.values()) if (t.order >= this.nextOrder) this.nextOrder = t.order + 1;
  }

  private applyEvent(ev: Event): void {
    if (ev.kind === 'add') {
      this.tasks.set(ev.task.id, { ...ev.task });
    } else if (ev.kind === 'update') {
      const cur = this.tasks.get(ev.id);
      if (cur) this.tasks.set(ev.id, { ...cur, ...ev.patch, updatedAt: Date.now() });
    } else if (ev.kind === 'remove') {
      this.tasks.delete(ev.id);
    }
  }

  private async append(ev: Event): Promise<void> {
    try { await fs.appendFile(this.logPath, JSON.stringify(ev) + '\n', 'utf8'); }
    catch { /* best-effort */ }
  }

  async add(title: string, notes?: string): Promise<InternalTask> {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('title required');
    const now = Date.now();
    const task: InternalTask = {
      id: randomUUID(),
      title: trimmed,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      notes,
      order: this.nextOrder++
    };
    const ev: Event = { kind: 'add', task };
    this.applyEvent(ev);
    await this.append(ev);
    return task;
  }

  async update(id: string, patch: Partial<Pick<InternalTask, 'title' | 'status' | 'notes' | 'order'>>): Promise<InternalTask | null> {
    if (!this.tasks.has(id)) return null;
    const ev: Event = { kind: 'update', id, patch };
    this.applyEvent(ev);
    await this.append(ev);
    return this.tasks.get(id) ?? null;
  }

  async remove(id: string): Promise<boolean> {
    if (!this.tasks.has(id)) return false;
    const ev: Event = { kind: 'remove', id };
    this.applyEvent(ev);
    await this.append(ev);
    return true;
  }

  list(): InternalTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => {
      // pending first, then in-progress, then done; within group by order asc.
      const rank = (s: InternalTaskStatus) => s === 'pending' ? 0 : s === 'in-progress' ? 1 : 2;
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      return a.order - b.order;
    });
  }

  dispose(): void { /* nothing */ }
}
