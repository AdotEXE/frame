#!/usr/bin/env node
// Frame MCP bridge — speaks the MCP stdio JSON-RPC protocol on stdin/stdout
// and proxies tool calls to the Frame HTTP API on 127.0.0.1:47822.
// Wire it up in ~/.claude/settings.json:
//   "mcpServers": {
//     "frame": {
//       "command": "node",
//       "args": ["C:\\Users\\PC\\Desktop\\frame\\scripts\\mcp-bridge.cjs"]
//     }
//   }

const http = require('node:http');
const readline = require('node:readline');

const FRAME_HOST = '127.0.0.1';
const FRAME_PORT = 47822;
const PROTOCOL_VERSION = '2024-11-05';

// ---------- HTTP helpers ----------
function frameRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      host: FRAME_HOST, port: FRAME_PORT, path, method,
      headers: data
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        : {}
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }); }
        catch (e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ---------- Tool definitions ----------
const TOOLS = [
  {
    name: 'frame_list_sessions',
    description: 'List Frame terminal sessions (PTY-backed local shells).',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => frameRequest('GET', '/api/sessions')
  },
  {
    name: 'frame_spawn_session',
    description: 'Spawn a new Frame terminal session in the given cwd.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Absolute working directory.' },
        label: { type: 'string', description: 'Tab label.' }
      }
    },
    handler: async (args) => frameRequest('POST', '/api/sessions', args)
  },
  {
    name: 'frame_kill_session',
    description: 'Kill a Frame terminal session by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    handler: async (args) => frameRequest('DELETE', `/api/sessions/${encodeURIComponent(args.id)}`)
  },
  {
    name: 'frame_send_input',
    description: 'Write a string into a Frame session stdin (append \\n if you want Enter pressed).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, data: { type: 'string' } },
      required: ['id', 'data']
    },
    handler: async (args) => frameRequest('POST', `/api/sessions/${encodeURIComponent(args.id)}/input`, { data: args.data })
  },
  {
    name: 'frame_get_buffer',
    description: 'Get the recent stdout buffer of a Frame session (~200KB ring).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    handler: async (args) => frameRequest('GET', `/api/sessions/${encodeURIComponent(args.id)}/buffer`)
  },
  {
    name: 'frame_queue_list',
    description: 'List items in the Frame internal task queue.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => frameRequest('GET', '/api/queue')
  },
  {
    name: 'frame_queue_add',
    description: 'Add a new task to the Frame queue (status defaults to pending).',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, notes: { type: 'string' } },
      required: ['title']
    },
    handler: async (args) => frameRequest('POST', '/api/queue', args)
  },
  {
    name: 'frame_queue_update',
    description: 'Update a queue item — change status (pending|in-progress|done), title, or notes.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'in-progress', 'done'] },
        title: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['id']
    },
    handler: async (args) => {
      const { id, ...patch } = args;
      return frameRequest('PATCH', `/api/queue/${encodeURIComponent(id)}`, patch);
    }
  },
  {
    name: 'frame_queue_remove',
    description: 'Remove a queue item by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    handler: async (args) => frameRequest('DELETE', `/api/queue/${encodeURIComponent(args.id)}`)
  },
  {
    name: 'frame_get_tasks',
    description: 'Get the snapshot of all Claude Code agents Frame can see (PTY + external via hook bridge), per-agent inflight tool, recent tools, subagents.',
    inputSchema: { type: 'object', properties: { hours: { type: 'number', default: 6 } } },
    handler: async (args) => frameRequest('GET', `/api/tasks?hours=${args.hours ?? 6}`)
  },
  {
    name: 'frame_get_cost',
    description: 'Get token + USD cost summary across ~/.claude/projects JSONL logs for the last N hours.',
    inputSchema: { type: 'object', properties: { hours: { type: 'number', default: 24 } } },
    handler: async (args) => frameRequest('GET', `/api/cost?hours=${args.hours ?? 24}`)
  },
  {
    name: 'frame_list_screenshots',
    description: 'List entries in the Frame screenshot vault.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => frameRequest('GET', '/api/screenshots')
  },
  {
    name: 'frame_capture_clipboard_screenshot',
    description: 'Save the current clipboard image to the Frame screenshot vault.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => frameRequest('POST', '/api/screenshots/clipboard')
  },
  {
    name: 'frame_get_locks',
    description: 'Get current file-lock state — which session is editing which file.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => frameRequest('GET', '/api/locks')
  },
  {
    name: 'frame_set_panel',
    description: "Switch Frame's right panel. Valid: dashboard, tasks, screenshots, video, locks.",
    inputSchema: {
      type: 'object',
      properties: { panel: { type: 'string', enum: ['dashboard', 'tasks', 'screenshots', 'video', 'locks'] } },
      required: ['panel']
    },
    handler: async (args) => frameRequest('POST', '/api/panel', { panel: args.panel })
  }
];

// ---------- JSON-RPC stdio loop ----------
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }

  try {
    const result = await handle(req);
    if (req.id !== undefined && result !== undefined) {
      send({ jsonrpc: '2.0', id: req.id, result });
    }
  } catch (err) {
    if (req.id !== undefined) {
      send({ jsonrpc: '2.0', id: req.id, error: { code: -32000, message: (err && err.message) || String(err) } });
    }
  }
});

async function handle(req) {
  switch (req.method) {
    case 'initialize':
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'frame-bridge', version: '0.2.6' }
      };
    case 'notifications/initialized':
      return undefined;
    case 'tools/list':
      return {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        }))
      };
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === req.params.name);
      if (!tool) throw new Error(`unknown tool: ${req.params.name}`);
      const args = req.params.arguments || {};
      const r = await tool.handler(args);
      return {
        content: [
          {
            type: 'text',
            text: typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2)
          }
        ],
        isError: r.status >= 400
      };
    }
    case 'resources/list':
      return { resources: [] };
    case 'prompts/list':
      return { prompts: [] };
    default:
      throw new Error(`unsupported method: ${req.method}`);
  }
}
