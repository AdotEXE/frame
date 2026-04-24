import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface ToolEvent {
  id: string;
  name: string;
  inputPreview: string;
  ts: number;
}

export interface SubagentInvocation {
  id: string;
  type: string;
  description: string;
  promptPreview: string;
  status: 'inflight' | 'done';
  startedAt: number;
}

export interface TaskAgent {
  sessionId: string;
  projectKey: string;
  cwd: string;
  fileMtime: number;
  lastUserPrompt: string | null;
  lastUserPromptAt: number | null;
  inflightTool: ToolEvent | null;
  recentTools: ToolEvent[];
  subagents: SubagentInvocation[];
  totalTurns: number;
}

export interface TasksSummary {
  agents: TaskAgent[];
  scannedAt: number;
  windowHours: number;
}

const RECENT_TOOL_CAP = 10;

function snippet(s: string, max = 140): string {
  if (!s) return '';
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? trimmed.slice(0, max) + '…' : trimmed;
}

function decodeProjectKey(folder: string): string {
  // Claude Code encodes cwd as folder name with separators replaced — best effort decode.
  return folder.replace(/^C--/, 'C:\\').replace(/-/g, '\\');
}

export class TasksScanner {
  private root: string;

  constructor() {
    this.root = path.join(os.homedir(), '.claude', 'projects');
  }

  async summary(windowHours = 6): Promise<TasksSummary> {
    const since = Date.now() - windowHours * 3_600_000;
    const out: TasksSummary = { agents: [], scannedAt: Date.now(), windowHours };

    let projects: string[];
    try { projects = await fs.readdir(this.root); }
    catch { return out; }

    for (const proj of projects) {
      const dir = path.join(this.root, proj);
      let files: string[];
      try { files = await fs.readdir(dir); }
      catch { continue; }
      for (const f of files) {
        if (!f.endsWith('.jsonl')) continue;
        const filePath = path.join(dir, f);
        try {
          const stat = await fs.stat(filePath);
          if (stat.mtimeMs < since) continue;
          const agent = await this.parseFile(filePath, proj, stat.mtimeMs);
          if (agent) out.agents.push(agent);
        } catch { /* skip unreadable */ }
      }
    }

    out.agents.sort((a, b) => b.fileMtime - a.fileMtime);
    return out;
  }

  private async parseFile(filePath: string, projectKey: string, mtime: number): Promise<TaskAgent | null> {
    const sessionId = path.basename(filePath, '.jsonl');
    let raw: string;
    try { raw = await fs.readFile(filePath, 'utf8'); }
    catch { return null; }

    const agent: TaskAgent = {
      sessionId,
      projectKey,
      cwd: decodeProjectKey(projectKey),
      fileMtime: mtime,
      lastUserPrompt: null,
      lastUserPromptAt: null,
      inflightTool: null,
      recentTools: [],
      subagents: [],
      totalTurns: 0
    };

    const pendingTools = new Map<string, ToolEvent>();
    const subagentMap = new Map<string, SubagentInvocation>();

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let entry: Record<string, unknown>;
      try { entry = JSON.parse(line) as Record<string, unknown>; }
      catch { continue; }

      const type = entry.type as string | undefined;
      const ts = typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : (entry.timestamp as number) || mtime;
      if (typeof entry.cwd === 'string' && entry.cwd) agent.cwd = entry.cwd;

      const message = entry.message as { role?: string; content?: unknown } | undefined;
      const role = message?.role ?? type;

      if (role === 'user') {
        const content = message?.content;
        if (typeof content === 'string') {
          agent.lastUserPrompt = snippet(content, 200);
          agent.lastUserPromptAt = ts;
          agent.totalTurns++;
        } else if (Array.isArray(content)) {
          for (const block of content as Array<Record<string, unknown>>) {
            if (block.type === 'text' && typeof block.text === 'string') {
              agent.lastUserPrompt = snippet(block.text, 200);
              agent.lastUserPromptAt = ts;
              agent.totalTurns++;
            } else if (block.type === 'tool_result') {
              const useId = block.tool_use_id as string | undefined;
              if (useId) {
                pendingTools.delete(useId);
                const sub = subagentMap.get(useId);
                if (sub) sub.status = 'done';
              }
            }
          }
        }
      } else if (role === 'assistant') {
        const content = message?.content;
        if (Array.isArray(content)) {
          for (const block of content as Array<Record<string, unknown>>) {
            if (block.type === 'tool_use') {
              const id = (block.id as string) ?? '';
              const name = (block.name as string) ?? 'unknown';
              const input = block.input as Record<string, unknown> | undefined;
              const inputStr = input ? JSON.stringify(input) : '';
              const tool: ToolEvent = { id, name, inputPreview: snippet(inputStr, 120), ts };
              pendingTools.set(id, tool);
              agent.recentTools.push(tool);
              if (name === 'Task' && input) {
                const sub: SubagentInvocation = {
                  id,
                  type: (input.subagent_type as string) ?? 'general-purpose',
                  description: (input.description as string) ?? '',
                  promptPreview: snippet((input.prompt as string) ?? '', 200),
                  status: 'inflight',
                  startedAt: ts
                };
                subagentMap.set(id, sub);
                agent.subagents.push(sub);
              }
            }
          }
        }
      }
    }

    // Inflight = newest still-pending tool_use.
    if (pendingTools.size > 0) {
      const arr = Array.from(pendingTools.values()).sort((a, b) => b.ts - a.ts);
      agent.inflightTool = arr[0];
    }
    agent.recentTools = agent.recentTools.slice(-RECENT_TOOL_CAP).reverse();
    return agent;
  }
}
