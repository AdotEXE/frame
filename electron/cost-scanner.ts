import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface CostSummary {
  inputTokens: number;
  outputTokens: number;
  cacheCreate: number;
  cacheRead: number;
  totalUsdEstimate: number;
  sessions: number;
  files: number;
  windowHours: number;
  lastActivity: number | null;
}

// Per-model USD/MTok rate cards — Anthropic public pricing 2025/2026.
interface Rate { input: number; output: number; cacheCreate: number; cacheRead: number; }
const M = 1_000_000;
const RATES: Record<string, Rate> = {
  opus:   { input: 15 / M,   output: 75 / M,   cacheCreate: 18.75 / M,  cacheRead: 1.5  / M },
  sonnet: { input: 3  / M,   output: 15 / M,   cacheCreate: 3.75  / M,  cacheRead: 0.3  / M },
  haiku:  { input: 0.8/ M,   output: 4  / M,   cacheCreate: 1     / M,  cacheRead: 0.08 / M }
};
function rateFor(model: string): Rate {
  if (!model) return RATES.opus;
  const m = model.toLowerCase();
  if (m.includes('haiku')) return RATES.haiku;
  if (m.includes('sonnet')) return RATES.sonnet;
  return RATES.opus;
}

export class CostScanner {
  private root: string;

  constructor() {
    this.root = path.join(os.homedir(), '.claude', 'projects');
  }

  async summary(windowHours = 24): Promise<CostSummary> {
    const since = Date.now() - windowHours * 3_600_000;
    const out: CostSummary = {
      inputTokens: 0, outputTokens: 0, cacheCreate: 0, cacheRead: 0,
      totalUsdEstimate: 0, sessions: 0, files: 0, windowHours, lastActivity: null
    };

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
          out.files++;
          out.sessions++;
          if (!out.lastActivity || stat.mtimeMs > out.lastActivity) out.lastActivity = stat.mtimeMs;
          await this.parseFile(filePath, out);
        } catch { /* unreadable, skip */ }
      }
    }

    return out;
  }

  // Per-turn USD calculation using the model recorded in each entry — Sonnet
  // and Haiku turns get their real rate cards, not Opus rates.
  private async parseFile(filePath: string, out: CostSummary): Promise<void> {
    const raw = await fs.readFile(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        const usage = j?.message?.usage ?? j?.usage;
        if (!usage) continue;
        const model = j?.message?.model ?? '';
        const rate = rateFor(model);
        const inT = Number(usage.input_tokens ?? 0);
        const outT = Number(usage.output_tokens ?? 0);
        const cWr = Number(usage.cache_creation_input_tokens ?? 0);
        const cRd = Number(usage.cache_read_input_tokens ?? 0);
        out.inputTokens  += inT;
        out.outputTokens += outT;
        out.cacheCreate  += cWr;
        out.cacheRead    += cRd;
        out.totalUsdEstimate +=
          inT  * rate.input +
          outT * rate.output +
          cWr  * rate.cacheCreate +
          cRd  * rate.cacheRead;
      } catch { /* skip bad line */ }
    }
  }
}
