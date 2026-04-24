import { clipboard, nativeImage } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FramePaths } from './paths.js';

export interface ScreenshotEntry {
  id: string;
  path: string;
  label: string | null;
  createdAt: number;
  source: 'clipboard' | 'hotkey' | 'drop' | 'manual';
  width: number;
  height: number;
  bytes: number;
  hash: string;
}

interface Opts {
  onCapture(entry: ScreenshotEntry): void;
}

// JSON-Lines store. One row per line, append-only writes, full read on init.
// Picked over SQLite because Electron 33 ships Node 20 (no node:sqlite). For
// expected volume (thousands of screenshots) this is fine; switch to SQLite
// once we bump Electron to ≥36.

export class ScreenshotStore {
  private timer: NodeJS.Timeout | null = null;
  private lastHash: string | null = null;
  private rows: ScreenshotEntry[] = [];
  private byHash = new Map<string, ScreenshotEntry>();
  private byId = new Map<string, ScreenshotEntry>();
  private logPath = '';

  constructor(private readonly opts: Opts) {}

  async init(): Promise<void> {
    const paths = FramePaths.all();
    this.logPath = path.join(paths.data, 'screenshots.jsonl');
    try {
      const raw = await fs.readFile(this.logPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as ScreenshotEntry & { _deleted?: boolean };
          if (parsed._deleted) {
            const existing = this.byId.get(parsed.id);
            if (existing) {
              this.rows = this.rows.filter((r) => r.id !== parsed.id);
              this.byHash.delete(existing.hash);
              this.byId.delete(parsed.id);
            }
            continue;
          }
          this.rows.push(parsed);
          this.byHash.set(parsed.hash, parsed);
          this.byId.set(parsed.id, parsed);
        } catch { /* skip corrupt line */ }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  startClipboardWatcher(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.pollClipboard(); }, 1500);
  }

  private async pollClipboard(): Promise<void> {
    const img = clipboard.readImage();
    if (img.isEmpty()) return;
    const buf = img.toPNG();
    const hash = createHash('sha1').update(buf).digest('hex');
    if (hash === this.lastHash) return;
    this.lastHash = hash;
    if (this.byHash.has(hash)) return;
    const entry = await this.persist(buf, img.getSize(), 'clipboard', null, hash);
    this.opts.onCapture(entry);
  }

  async captureFromClipboard(label?: string): Promise<ScreenshotEntry | null> {
    const img = clipboard.readImage();
    if (img.isEmpty()) return null;
    const buf = img.toPNG();
    const hash = createHash('sha1').update(buf).digest('hex');
    const dup = this.byHash.get(hash);
    if (dup) return dup;
    this.lastHash = hash;
    return this.persist(buf, img.getSize(), 'hotkey', label ?? null, hash);
  }

  async saveImage(buf: Buffer, label?: string): Promise<ScreenshotEntry> {
    const img = nativeImage.createFromBuffer(buf);
    const hash = createHash('sha1').update(buf).digest('hex');
    const dup = this.byHash.get(hash);
    if (dup) return dup;
    return this.persist(buf, img.getSize(), 'manual', label ?? null, hash);
  }

  private async persist(
    buf: Buffer,
    size: { width: number; height: number },
    source: ScreenshotEntry['source'],
    label: string | null,
    hash: string
  ): Promise<ScreenshotEntry> {
    const id = randomUUID();
    const paths = FramePaths.all();
    const fileName = `${Date.now()}_${id.slice(0, 8)}.png`;
    const filePath = path.join(paths.screenshots, fileName);
    await fs.writeFile(filePath, buf);
    const entry: ScreenshotEntry = {
      id,
      path: filePath,
      label,
      createdAt: Date.now(),
      source,
      width: size.width,
      height: size.height,
      bytes: buf.length,
      hash
    };
    this.rows.push(entry);
    this.byHash.set(hash, entry);
    this.byId.set(id, entry);
    await fs.appendFile(this.logPath, JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  list(limit = 200): ScreenshotEntry[] {
    return [...this.rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  async read(id: string): Promise<string | null> {
    const row = this.byId.get(id);
    if (!row) return null;
    try {
      const buf = await fs.readFile(row.path);
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    const row = this.byId.get(id);
    if (!row) return false;
    this.rows = this.rows.filter((r) => r.id !== id);
    this.byHash.delete(row.hash);
    this.byId.delete(id);
    await fs.appendFile(this.logPath, JSON.stringify({ id, _deleted: true }) + '\n', 'utf8');
    try { await fs.unlink(row.path); } catch { /* already gone */ }
    return true;
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
