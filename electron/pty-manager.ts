import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';

interface SpawnOpts {
  cwd: string;
  cols: number;
  rows: number;
  label: string;
}

interface Session {
  id: string;
  label: string;
  cwd: string;
  pid: number;
  proc: ChildProcessWithoutNullStreams;
  buffer: string[];
  bufferBytes: number;
}

interface PtyManagerOpts {
  onData(sessionId: string, data: string): void;
  onExit(sessionId: string, code: number): void;
}

const isWin = process.platform === 'win32';
const shellCmd = isWin ? 'powershell.exe' : (process.env.SHELL ?? '/bin/bash');
const shellArgs = isWin ? ['-NoLogo', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass'] : [];

const BUFFER_BYTE_CAP = 200 * 1024;

export class PtyManager {
  private sessions = new Map<string, Session>();

  constructor(private readonly opts: PtyManagerOpts) {}

  spawn(opts: SpawnOpts): { id: string; pid: number } {
    const id = randomUUID();
    const proc = spawn(shellCmd, shellArgs, {
      cwd: opts.cwd,
      env: {
        ...process.env,
        FRAME_SESSION_ID: id,
        TERM: 'dumb',
        FORCE_COLOR: '1'
      },
      windowsHide: true
    });

    const session: Session = {
      id, label: opts.label, cwd: opts.cwd, pid: proc.pid ?? 0, proc,
      buffer: [], bufferBytes: 0
    };
    this.sessions.set(id, session);

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    const collect = (data: string) => {
      this.appendToBuffer(session, data);
      this.opts.onData(id, data);
    };
    proc.stdout.on('data', collect);
    proc.stderr.on('data', collect);
    proc.on('exit', (code) => {
      this.opts.onExit(id, code ?? 0);
      this.sessions.delete(id);
    });
    proc.on('error', (err) => {
      const msg = `\r\n[frame] spawn error: ${err.message}\r\n`;
      this.appendToBuffer(session, msg);
      this.opts.onData(id, msg);
    });

    return { id, pid: proc.pid ?? 0 };
  }

  private appendToBuffer(session: Session, data: string): void {
    session.buffer.push(data);
    session.bufferBytes += Buffer.byteLength(data, 'utf8');
    while (session.bufferBytes > BUFFER_BYTE_CAP && session.buffer.length > 1) {
      const dropped = session.buffer.shift()!;
      session.bufferBytes -= Buffer.byteLength(dropped, 'utf8');
    }
  }

  getBuffer(id: string): string {
    const s = this.sessions.get(id);
    if (!s) return '';
    return s.buffer.join('');
  }

  write(id: string, data: string): boolean {
    const s = this.sessions.get(id);
    if (!s || !s.proc.stdin.writable) return false;
    s.proc.stdin.write(data);
    return true;
  }

  resize(_id: string, _cols: number, _rows: number): boolean {
    return false;
  }

  kill(id: string): boolean {
    const s = this.sessions.get(id);
    if (!s) return false;
    try { s.proc.kill(); } catch { /* already dead */ }
    this.sessions.delete(id);
    return true;
  }

  list(): Array<Pick<Session, 'id' | 'label' | 'cwd' | 'pid'>> {
    return Array.from(this.sessions.values()).map(({ id, label, cwd, pid }) => ({ id, label, cwd, pid }));
  }

  disposeAll(): void {
    for (const s of this.sessions.values()) {
      try { s.proc.kill(); } catch { /* already gone */ }
    }
    this.sessions.clear();
  }
}
