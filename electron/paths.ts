import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

const root = path.join(app?.getPath('userData') ?? path.join(process.env.APPDATA ?? process.cwd(), 'frame'), 'frame');

export const FramePaths = {
  all() {
    return {
      root,
      screenshots: path.join(root, 'screenshots'),
      videos: path.join(root, 'videos'),
      data: path.join(root, 'data')
    };
  },
  async ensure(): Promise<void> {
    const p = this.all();
    await Promise.all([
      fs.mkdir(p.root, { recursive: true }),
      fs.mkdir(p.screenshots, { recursive: true }),
      fs.mkdir(p.videos, { recursive: true }),
      fs.mkdir(p.data, { recursive: true })
    ]);
  }
};
