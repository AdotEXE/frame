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

export interface SessionInfo {
  id: string;
  label: string;
  cwd: string;
  pid: number;
  status: 'idle' | 'busy' | 'waiting' | 'error';
  lastTool?: string;
  lastFile?: string;
  events: number;
}

export interface FrameHookEvent {
  sessionId?: string;
  cwd?: string;
  hook?: string;
  tool?: string;
  filePath?: string;
  filePaths?: string[];
  status?: string;
  ts: number;
}

export interface VideoJob {
  id: string;
  source: string;
  outDir: string;
  baseFps: number;
  baseWidth: number;
  createdAt: number;
  passCount: number;
  totalFrames: number;
}

export interface LockState {
  files: Array<{ path: string; sessionId: string; sinceMs: number }>;
}
