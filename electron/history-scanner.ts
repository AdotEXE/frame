import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export type Metric = 'usd' | 'tokens' | 'tools';

export interface HeatmapCell {
  dayOffset: number; // 0 = today, 1 = yesterday, …
  hour: number;       // 0-23 local time
  usd: number;
  tokens: number;
  tools: number;
  sessionIds: string[];
}

export interface HeatmapResult {
  cells: HeatmapCell[];
  days: number;
  startDayMs: number;
  scannedAt: number;
}

const M = 1_000_000;
const RATE = {
  opus:   { input: 15 / M,   output: 75 / M,   cw: 18.75 / M,  cr: 1.5  / M },
  sonnet: { input: 3  / M,   output: 15 / M,   cw: 3.75  / M,  cr: 0.3  / M },
  haiku:  { input: 0.8/ M,   output: 4  / M,   cw: 1     / M,  cr: 0.08 / M }
};
function rateFor(model: string) {
  const m = (model ?? '').toLowerCase();
  if (m.includes('haiku')) return RATE.haiku;
  if (m.includes('sonnet')) return RATE.sonnet;
  return RATE.opus;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export class HistoryScanner {
  private root: string;

  constructor() {
    this.root = path.join(os.homedir(), '.claude', 'projects');
  }

  async heatmap(days = 30): Promise<HeatmapResult> {
    const now = Date.now();
    const todayStart = startOfLocalDay(now);
    const startDayMs = todayStart - (days - 1) * 86_400_000;
    const cellMap = new Map<string, HeatmapCell>();

    let projects: string[];
    try { projects = await fs.readdir(this.root); }
    catch { return { cells: [], days, startDayMs, scannedAt: now }; }

    for (const proj of projects) {
      const dir = path.join(this.root, proj);
      let files: string[];
      try { files = await fs.readdir(dir); }
      catch { continue; }
      for (const f of files) {
        if (!f.endsWith('.jsonl')) continue;
        const filePath = path.join(dir, f);
        const sessionId = f.replace(/\.jsonl$/, '');
        try {
          const stat = await fs.stat(filePath);
          if (stat.mtimeMs < startDayMs) continue;
          await this.scanFile(filePath, sessionId, startDayMs, todayStart, cellMap);
        } catch { /* unreadable */ }
      }
    }

    return {
      cells: Array.from(cellMap.values()).sort((a, b) => a.dayOffset - b.dayOffset || a.hour - b.hour),
      days,
      startDayMs,
      scannedAt: now
    };
  }

  private async scanFile(
    filePath: string,
    sessionId: string,
    startDayMs: number,
    todayStart: number,
    cellMap: Map<string, HeatmapCell>
  ): Promise<void> {
    const raw = await fs.readFile(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        const usage = j?.message?.usage ?? j?.usage;
        if (!usage) continue;
        const tsStr = j?.timestamp;
        const ts = typeof tsStr === 'string' ? Date.parse(tsStr) : (typeof tsStr === 'number' ? tsStr : null);
        if (!ts || ts < startDayMs) continue;
        const dayMs = startOfLocalDay(ts);
        const dayOffset = Math.round((todayStart - dayMs) / 86_400_000);
        if (dayOffset < 0) continue;
        const hour = new Date(ts).getHours();
        const key = `${dayOffset}:${hour}`;
        let cell = cellMap.get(key);
        if (!cell) {
          cell = { dayOffset, hour, usd: 0, tokens: 0, tools: 1, sessionIds: [sessionId] };
          cellMap.set(key, cell);
        } else {
          cell.tools += 1;
          if (!cell.sessionIds.includes(sessionId)) cell.sessionIds.push(sessionId);
        }
        const r = rateFor(j?.message?.model ?? '');
        const inT = Number(usage.input_tokens ?? 0);
        const outT = Number(usage.output_tokens ?? 0);
        const cw = Number(usage.cache_creation_input_tokens ?? 0);
        const cr = Number(usage.cache_read_input_tokens ?? 0);
        cell.tokens += inT + outT + cw + cr;
        cell.usd += inT * r.input + outT * r.output + cw * r.cw + cr * r.cr;
      } catch { /* skip */ }
    }
  }
}
