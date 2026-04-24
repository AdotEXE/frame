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

// Rough USD/MTok rate cards (Opus 4.7 / 4.6 ballpark — directional only).
const RATE = {
  input: 15 / 1_000_000,
  output: 75 / 1_000_000,
  cacheCreate: 18.75 / 1_000_000,
  cacheRead: 1.5 / 1_000_000
};

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

    out.totalUsdEstimate =
      out.inputTokens * RATE.input +
      out.outputTokens * RATE.output +
      out.cacheCreate * RATE.cacheCreate +
      out.cacheRead * RATE.cacheRead;

    return out;
  }

  private async parseFile(filePath: string, out: CostSummary): Promise<void> {
    const raw = await fs.readFile(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        const usage = j?.message?.usage ?? j?.usage;
        if (!usage) continue;
        out.inputTokens += Number(usage.input_tokens ?? 0);
        out.outputTokens += Number(usage.output_tokens ?? 0);
        out.cacheCreate += Number(usage.cache_creation_input_tokens ?? 0);
        out.cacheRead += Number(usage.cache_read_input_tokens ?? 0);
      } catch { /* skip bad line */ }
    }
  }
}
