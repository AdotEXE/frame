import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FramePaths } from './paths.js';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

interface ExtractOpts {
  fps: number;
  width?: number;
}

interface ZoomOpts {
  startSec: number;
  endSec: number;
  fps: number;
  width: number;
}

interface Job {
  id: string;
  source: string;
  outDir: string;
  baseFps: number;
  baseWidth: number;
  passes: Array<{ kind: 'base' | 'zoom'; startSec?: number; endSec?: number; fps: number; width: number; frames: string[] }>;
  createdAt: number;
}

interface Opts {
  onProgress(jobId: string, progress: number): void;
  onFrames(jobId: string, frames: string[]): void;
}

export class VideoPipeline {
  private jobs = new Map<string, Job>();

  constructor(private readonly opts: Opts) {}

  async extractFrames(source: string, ex: ExtractOpts): Promise<{ jobId: string; outDir: string }> {
    const id = randomUUID();
    const outDir = path.join(FramePaths.all().videos, id);
    await fs.mkdir(outDir, { recursive: true });
    const width = ex.width ?? 960;
    const job: Job = {
      id,
      source,
      outDir,
      baseFps: ex.fps,
      baseWidth: width,
      passes: [],
      createdAt: Date.now()
    };
    this.jobs.set(id, job);
    void this.runPass(job, { kind: 'base', fps: ex.fps, width, startSec: 0 });
    return { jobId: id, outDir };
  }

  async zoomIn(jobId: string, opts: ZoomOpts): Promise<{ frames: string[] } | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const frames = await this.runPass(job, {
      kind: 'zoom',
      startSec: opts.startSec,
      endSec: opts.endSec,
      fps: opts.fps,
      width: opts.width
    });
    return { frames };
  }

  private runPass(
    job: Job,
    pass: { kind: 'base' | 'zoom'; startSec?: number; endSec?: number; fps: number; width: number }
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const passIndex = job.passes.length;
      const subDir = path.join(job.outDir, `pass-${passIndex}-${pass.kind}`);
      const frames: string[] = [];
      void fs.mkdir(subDir, { recursive: true }).then(() => {
        const cmd = ffmpeg(job.source);
        if (pass.startSec !== undefined && pass.startSec > 0) cmd.seekInput(pass.startSec);
        if (pass.endSec !== undefined && pass.startSec !== undefined) {
          cmd.duration(Math.max(0.1, pass.endSec - pass.startSec));
        }
        cmd
          .outputOptions([`-vf fps=${pass.fps},scale=${pass.width}:-2`])
          .output(path.join(subDir, 'frame_%05d.png'))
          .on('progress', (p) => {
            if (typeof p.percent === 'number') this.opts.onProgress(job.id, p.percent);
          })
          .on('end', async () => {
            try {
              const files = (await fs.readdir(subDir)).filter((f) => f.endsWith('.png')).sort();
              for (const f of files) frames.push(path.join(subDir, f));
              job.passes.push({ ...pass, frames });
              this.opts.onFrames(job.id, frames);
              resolve(frames);
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          })
          .on('error', (err) => reject(err))
          .run();
      });
    });
  }

  listJobs(): Array<Omit<Job, 'passes'> & { passCount: number; totalFrames: number }> {
    return Array.from(this.jobs.values()).map((j) => ({
      id: j.id,
      source: j.source,
      outDir: j.outDir,
      baseFps: j.baseFps,
      baseWidth: j.baseWidth,
      createdAt: j.createdAt,
      passCount: j.passes.length,
      totalFrames: j.passes.reduce((sum, p) => sum + p.frames.length, 0)
    }));
  }

  dispose(): void {
    this.jobs.clear();
  }
}
