import http from 'node:http';
import type { PtyManager } from './pty-manager.js';
import type { InternalTasksStore } from './internal-tasks.js';
import type { ScreenshotStore } from './screenshot-store.js';
import type { TasksScanner } from './tasks-scanner.js';
import type { CostScanner } from './cost-scanner.js';
import type { Coordinator } from './coordinator.js';

interface Deps {
  pty: PtyManager;
  internalTasks: InternalTasksStore;
  screenshots: ScreenshotStore;
  tasks: TasksScanner;
  cost: CostScanner;
  coordinator: Coordinator;
  defaultCwd: string;
  setPanel(name: string): void;
}

export const FRAME_API_PORT = 47822;

export class ApiServer {
  private server: http.Server | null = null;

  constructor(private readonly deps: Deps) {}

  async start(): Promise<void> {
    this.server = http.createServer(async (req, res) => {
      try {
        await this.route(req, res);
      } catch (err) {
        respond(res, 500, { error: (err as Error).message });
      }
    });
    await new Promise<void>((resolve) => this.server!.listen(FRAME_API_PORT, '127.0.0.1', resolve));
  }

  private async route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${FRAME_API_PORT}`);
    const method = req.method ?? 'GET';
    const path = url.pathname;
    const { deps } = this;

    if (method === 'GET' && path === '/api/health') return respond(res, 200, { ok: true, version: '0.2.6' });

    // ---- sessions
    if (method === 'GET' && path === '/api/sessions') return respond(res, 200, deps.pty.list());
    if (method === 'POST' && path === '/api/sessions') {
      const body = await readBody(req);
      const cwd = typeof body.cwd === 'string' ? body.cwd : deps.defaultCwd;
      const label = typeof body.label === 'string' ? body.label : `session-${Date.now()}`;
      const cols = typeof body.cols === 'number' ? body.cols : 120;
      const rows = typeof body.rows === 'number' ? body.rows : 32;
      const r = deps.pty.spawn({ cwd, label, cols, rows });
      return respond(res, 200, r);
    }
    const sessMatch = path.match(/^\/api\/sessions\/([a-z0-9-]+)(\/.*)?$/);
    if (sessMatch) {
      const id = sessMatch[1];
      const sub = sessMatch[2];
      if (method === 'DELETE' && !sub) {
        return respond(res, 200, { killed: deps.pty.kill(id) });
      }
      if (method === 'POST' && sub === '/input') {
        const body = await readBody(req);
        const data = typeof body.data === 'string' ? body.data : '';
        return respond(res, 200, { written: deps.pty.write(id, data) });
      }
      if (method === 'GET' && sub === '/buffer') {
        return respond(res, 200, { buffer: deps.pty.getBuffer(id) });
      }
    }

    // ---- queue
    if (method === 'GET' && path === '/api/queue') return respond(res, 200, deps.internalTasks.list());
    if (method === 'POST' && path === '/api/queue') {
      const body = await readBody(req);
      if (typeof body.title !== 'string') return respond(res, 400, { error: 'title required' });
      const notes = typeof body.notes === 'string' ? body.notes : undefined;
      const t = await deps.internalTasks.add(body.title, notes);
      return respond(res, 200, t);
    }
    const queueMatch = path.match(/^\/api\/queue\/([a-z0-9-]+)$/);
    if (queueMatch) {
      const id = queueMatch[1];
      if (method === 'PATCH') {
        const body = await readBody(req);
        const patch: Record<string, unknown> = {};
        if (typeof body.title === 'string') patch.title = body.title;
        if (typeof body.notes === 'string') patch.notes = body.notes;
        if (typeof body.status === 'string') patch.status = body.status;
        if (typeof body.order === 'number') patch.order = body.order;
        const t = await deps.internalTasks.update(id, patch);
        return respond(res, 200, t);
      }
      if (method === 'DELETE') {
        return respond(res, 200, { removed: await deps.internalTasks.remove(id) });
      }
    }

    // ---- tasks (claude agent log scan)
    if (method === 'GET' && path === '/api/tasks') {
      const hours = Number(url.searchParams.get('hours') ?? 6);
      const r = await deps.tasks.summary(hours);
      return respond(res, 200, r);
    }

    // ---- cost
    if (method === 'GET' && path === '/api/cost') {
      const hours = Number(url.searchParams.get('hours') ?? 24);
      const r = await deps.cost.summary(hours);
      return respond(res, 200, r);
    }

    // ---- screenshots
    if (method === 'GET' && path === '/api/screenshots') return respond(res, 200, deps.screenshots.list(200));
    if (method === 'POST' && path === '/api/screenshots/clipboard') {
      const r = await deps.screenshots.captureFromClipboard('mcp');
      return respond(res, r ? 200 : 404, r ?? { error: 'clipboard has no image' });
    }

    // ---- locks
    if (method === 'GET' && path === '/api/locks') return respond(res, 200, deps.coordinator.snapshot());

    // ---- panel
    if (method === 'POST' && path === '/api/panel') {
      const body = await readBody(req);
      if (typeof body.panel !== 'string') return respond(res, 400, { error: 'panel required' });
      deps.setPanel(body.panel);
      return respond(res, 200, { panel: body.panel });
    }

    respond(res, 404, { error: 'not found', method, path });
  }

  dispose(): void { this.server?.close(); this.server = null; }
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try { resolve(JSON.parse(body) as Record<string, unknown>); }
      catch { resolve({}); }
    });
  });
}

function respond(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}
