import { create } from 'zustand';
import type { ScreenshotEntry, SessionInfo, FrameHookEvent, VideoJob, LockState, CostSummary } from '../types/frame';

interface WorkspaceState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  screenshots: ScreenshotEntry[];
  events: FrameHookEvent[];
  videoJobs: VideoJob[];
  locks: LockState;
  cost: CostSummary | null;
  panel: 'dashboard' | 'screenshots' | 'video' | 'locks';
  paths: { root: string; screenshots: string; videos: string; data: string } | null;

  init(): Promise<void>;
  setPanel(p: WorkspaceState['panel']): void;
  setActiveSession(id: string | null): void;
  createSession(opts: { cwd: string; label: string; cols: number; rows: number }): Promise<string>;
  killSession(id: string): Promise<void>;
  refreshScreenshots(): Promise<void>;
  refreshVideoJobs(): Promise<void>;
  refreshLocks(): Promise<void>;
  refreshCost(hours?: number): Promise<void>;
}

const STATUS_BUSY_MS = 4000;

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  screenshots: [],
  events: [],
  videoJobs: [],
  locks: { files: [] },
  cost: null,
  panel: 'dashboard',
  paths: null,

  async init() {
    const frame = window.frame;
    const paths = await frame.app.paths();
    set({ paths });

    frame.screenshots.onNew(() => { void get().refreshScreenshots(); });
    frame.coord.onChange((state) => set({ locks: state as LockState }));
    frame.hooks.onEvent((evt) => {
      const event = evt as FrameHookEvent;
      set((s) => ({
        events: [event, ...s.events].slice(0, 500),
        sessions: s.sessions.map((sess) =>
          sess.id === event.sessionId
            ? {
                ...sess,
                status: event.hook === 'PreToolUse' ? 'busy' : event.hook === 'PostToolUse' ? 'idle' : sess.status,
                lastTool: event.tool ?? sess.lastTool,
                lastFile: event.filePath ?? sess.lastFile,
                events: sess.events + 1
              }
            : sess
        )
      }));
      setTimeout(() => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === event.sessionId && sess.status === 'busy' ? { ...sess, status: 'idle' } : sess
          )
        }));
      }, STATUS_BUSY_MS);
    });

    await Promise.all([get().refreshScreenshots(), get().refreshVideoJobs(), get().refreshLocks(), get().refreshCost()]);

    // Refresh cost periodically — Claude Code logs grow during sessions.
    const costTimer = setInterval(() => { void get().refreshCost(); }, 30_000);
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => clearInterval(costTimer));
    }
  },

  setPanel(panel) { set({ panel }); },
  setActiveSession(id) { set({ activeSessionId: id }); },

  async createSession(opts) {
    const r = await window.frame.pty.create(opts);
    const session: SessionInfo = {
      id: r.id,
      label: opts.label,
      cwd: opts.cwd,
      pid: r.pid,
      status: 'idle',
      events: 0
    };
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: s.activeSessionId ?? r.id
    }));
    return r.id;
  },

  async killSession(id) {
    await window.frame.pty.kill(id);
    set((s) => {
      const remaining = s.sessions.filter((x) => x.id !== id);
      return {
        sessions: remaining,
        activeSessionId: s.activeSessionId === id ? (remaining[0]?.id ?? null) : s.activeSessionId
      };
    });
  },

  async refreshScreenshots() {
    const list = await window.frame.screenshots.list(200) as ScreenshotEntry[];
    set({ screenshots: list });
  },

  async refreshVideoJobs() {
    const jobs = await window.frame.video.listJobs() as VideoJob[];
    set({ videoJobs: jobs });
  },

  async refreshLocks() {
    const state = await window.frame.coord.state() as LockState;
    set({ locks: state });
  },

  async refreshCost(hours = 24) {
    const summary = await window.frame.cost.summary(hours);
    set({ cost: summary });
  }
}));
