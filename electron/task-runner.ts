import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import type { InternalTasksStore } from './internal-tasks.js';

interface Running {
  taskId: string;
  proc: ChildProcessWithoutNullStreams;
  startedAt: number;
  buffer: string[];
  bufferBytes: number;
  cwd: string;
}

interface RunnerOpts {
  onOutput(taskId: string, chunk: string): void;
  onExit(taskId: string, code: number, durationMs: number): void;
}

const BUFFER_CAP = 200 * 1024;
const CLAUDE_CMD = process.platform === 'win32' ? 'claude.cmd' : 'claude';

export class TaskRunner {
  private running = new Map<string, Running>();

  constructor(private readonly store: InternalTasksStore, private readonly opts: RunnerOpts) {}

  isRunning(taskId: string): boolean {
    return this.running.has(taskId);
  }

  async run(taskId: string, cwd: string): Promise<{ ok: true; startedAt: number } | { ok: false; error: string }> {
    if (this.running.has(taskId)) return { ok: false, error: 'already running' };
    const tasks = this.store.list();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'task not found' };

    let proc: ChildProcessWithoutNullStreams;
    try {
      proc = spawn(
        CLAUDE_CMD,
        [
          '--dangerously-skip-permissions',
          '--max-turns', '10',
          '--append-system-prompt',
          'You are a background task runner launched by Frame. Be terse, focus on doing the task, report final status briefly. Avoid asking the user questions.',
          '-p',
          task.title
        ],
        {
          cwd,
          env: { ...process.env },
          windowsHide: true,
          shell: process.platform === 'win32'
        }
      );
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }

    const state: Running = {
      taskId,
      proc,
      startedAt: Date.now(),
      buffer: [],
      bufferBytes: 0,
      cwd
    };
    this.running.set(taskId, state);

    await this.store.update(taskId, { status: 'in-progress' });

    const append = (data: string) => {
      state.buffer.push(data);
      state.bufferBytes += Buffer.byteLength(data, 'utf8');
      while (state.bufferBytes > BUFFER_CAP && state.buffer.length > 1) {
        const dropped = state.buffer.shift()!;
        state.bufferBytes -= Buffer.byteLength(dropped, 'utf8');
      }
      this.opts.onOutput(taskId, data);
    };

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', append);
    proc.stderr.on('data', append);

    proc.on('exit', async (code) => {
      const dur = Date.now() - state.startedAt;
      this.running.delete(taskId);
      const nextStatus = code === 0 ? 'done' : 'pending';
      await this.store.update(taskId, { status: nextStatus });
      this.opts.onExit(taskId, code ?? -1, dur);
    });

    proc.on('error', (err) => {
      append(`\n[frame-runner] spawn error: ${err.message}\n`);
    });

    return { ok: true, startedAt: state.startedAt };
  }

  kill(taskId: string): boolean {
    const r = this.running.get(taskId);
    if (!r) return false;
    try { r.proc.kill(); } catch { /* already dead */ }
    this.running.delete(taskId);
    void this.store.update(taskId, { status: 'pending' });
    return true;
  }

  getOutput(taskId: string): { running: boolean; startedAt: number | null; buffer: string } {
    const r = this.running.get(taskId);
    if (!r) return { running: false, startedAt: null, buffer: '' };
    return { running: true, startedAt: r.startedAt, buffer: r.buffer.join('') };
  }

  listRunning(): Array<{ taskId: string; startedAt: number; cwd: string }> {
    return Array.from(this.running.values()).map(({ taskId, startedAt, cwd }) => ({ taskId, startedAt, cwd }));
  }

  disposeAll(): void {
    for (const r of this.running.values()) {
      try { r.proc.kill(); } catch { /* already dead */ }
    }
    this.running.clear();
  }
}
