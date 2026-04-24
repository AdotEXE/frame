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

export interface VideoPass {
  kind: 'base' | 'zoom';
  fps: number;
  width: number;
  startSec?: number;
  endSec?: number;
  frames: string[];
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
  passes: VideoPass[];
}

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

export interface LockState {
  files: Array<{ path: string; sessionId: string; sinceMs: number }>;
}
