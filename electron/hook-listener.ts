import http from 'node:http';
import { FramePaths } from './paths.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface FrameHookEvent {
  sessionId?: string;
  cwd?: string;
  hook?: string;
  tool?: string;
  filePath?: string;
  filePaths?: string[];
  status?: string;
  ts: number;
  raw?: unknown;
}

interface Opts {
  onEvent(event: FrameHookEvent): void;
}

const PORT = 47821;

export class HookListener {
  private server: http.Server | null = null;

  constructor(private readonly opts: Opts) {}

  async start(): Promise<void> {
    await this.writeBridgeScript();

    this.server = http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/hook') {
        res.writeHead(404).end();
        return;
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const event: FrameHookEvent = {
            sessionId: parsed.session_id ?? parsed.sessionId ?? process.env.FRAME_SESSION_ID,
            cwd: parsed.cwd,
            hook: parsed.hook_event_name ?? parsed.hook,
            tool: parsed.tool_name ?? parsed.tool,
            filePath: parsed.tool_input?.file_path ?? parsed.filePath,
            filePaths: parsed.tool_input?.file_paths ?? parsed.filePaths,
            status: parsed.status,
            ts: Date.now(),
            raw: parsed
          };
          this.opts.onEvent(event);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        } catch {
          res.writeHead(400).end('{"ok":false}');
        }
      });
    });
    await new Promise<void>((resolve) => {
      this.server!.listen(PORT, '127.0.0.1', () => resolve());
    });
  }

  private async writeBridgeScript(): Promise<void> {
    const paths = FramePaths.all();
    const scriptPath = path.join(paths.root, 'frame-hook.cjs');
    const script = `#!/usr/bin/env node
// Frame hook bridge — pipes Claude Code hook payload to local Frame listener.
const http = require('node:http');
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(raw); } catch { process.exit(0); }
  const data = JSON.stringify(payload);
  const req = http.request({
    host: '127.0.0.1', port: ${PORT}, path: '/hook', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  }, (res) => res.resume());
  req.on('error', () => process.exit(0));
  req.write(data);
  req.end();
});
`;
    await fs.writeFile(scriptPath, script, 'utf8');
  }

  dispose(): void {
    this.server?.close();
    this.server = null;
  }
}
