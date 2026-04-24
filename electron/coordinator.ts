import fs from 'node:fs/promises';
import path from 'node:path';
import { FramePaths } from './paths.js';

export interface LockState {
  files: Array<{ path: string; sessionId: string; sinceMs: number }>;
}

interface Opts {
  onLockChange(state: LockState): void;
}

interface HookEvent {
  sessionId?: string;
  hook?: string;
  tool?: string;
  filePath?: string;
  filePaths?: string[];
}

interface Lock {
  sessionId: string;
  sinceMs: number;
}

export class Coordinator {
  private locks = new Map<string, Lock>();
  private storePath = '';
  private writeQueued = false;

  constructor(private readonly opts: Opts) {}

  async init(): Promise<void> {
    const paths = FramePaths.all();
    this.storePath = path.join(paths.data, 'locks.json');
    try {
      const raw = await fs.readFile(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, Lock>;
      for (const [p, l] of Object.entries(parsed)) this.locks.set(p, l);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  claim(sessionId: string, files: string[]): { granted: string[]; rejected: Array<{ path: string; holder: string }> } {
    const granted: string[] = [];
    const rejected: Array<{ path: string; holder: string }> = [];
    const now = Date.now();
    for (const f of files) {
      const holder = this.locks.get(f);
      if (holder && holder.sessionId !== sessionId) {
        rejected.push({ path: f, holder: holder.sessionId });
        continue;
      }
      this.locks.set(f, { sessionId, sinceMs: now });
      granted.push(f);
    }
    this.persist();
    this.broadcast();
    return { granted, rejected };
  }

  release(sessionId: string, files: string[]): number {
    let count = 0;
    if (files.length === 0) {
      for (const [p, l] of this.locks) {
        if (l.sessionId === sessionId) {
          this.locks.delete(p);
          count++;
        }
      }
    } else {
      for (const f of files) {
        const holder = this.locks.get(f);
        if (holder?.sessionId === sessionId) {
          this.locks.delete(f);
          count++;
        }
      }
    }
    this.persist();
    this.broadcast();
    return count;
  }

  snapshot(): LockState {
    const files = Array.from(this.locks.entries())
      .map(([p, l]) => ({ path: p, sessionId: l.sessionId, sinceMs: l.sinceMs }))
      .sort((a, b) => b.sinceMs - a.sinceMs);
    return { files };
  }

  applyHookEvent(event: HookEvent): void {
    if (!event.sessionId) return;
    const writeTools = new Set(['Edit', 'Write', 'NotebookEdit']);
    if (event.hook === 'PreToolUse' && event.tool && writeTools.has(event.tool)) {
      const files = event.filePaths ?? (event.filePath ? [event.filePath] : []);
      if (files.length > 0) this.claim(event.sessionId, files);
    }
    if (event.hook === 'PostToolUse' && event.tool && writeTools.has(event.tool)) {
      const files = event.filePaths ?? (event.filePath ? [event.filePath] : []);
      if (files.length > 0) this.release(event.sessionId, files);
    }
    if (event.hook === 'SessionEnd') {
      this.release(event.sessionId, []);
    }
  }

  private broadcast(): void {
    this.opts.onLockChange(this.snapshot());
  }

  private persist(): void {
    if (this.writeQueued) return;
    this.writeQueued = true;
    queueMicrotask(async () => {
      this.writeQueued = false;
      const obj: Record<string, Lock> = {};
      for (const [p, l] of this.locks) obj[p] = l;
      try { await fs.writeFile(this.storePath, JSON.stringify(obj, null, 2), 'utf8'); }
      catch { /* best-effort persistence */ }
    });
  }

  dispose(): void {
    /* nothing to close — JSON-backed */
  }
}
