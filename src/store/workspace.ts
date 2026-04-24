import { create } from 'zustand';
import type { ScreenshotEntry, SessionInfo, FrameHookEvent, VideoJob, LockState, CostSummary, TasksSummary, InternalTask } from '../types/frame';
import { useNotifications } from './notifications';

interface WorkspaceState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  screenshots: ScreenshotEntry[];
  events: FrameHookEvent[];
  videoJobs: VideoJob[];
  locks: LockState;
  cost: CostSummary | null;
  tasks: TasksSummary | null;
  queue: InternalTask[];
  panel: 'dashboard' | 'screenshots' | 'video' | 'locks' | 'tasks' | 'settings';
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
  refreshTasks(hours?: number): Promise<void>;
  refreshQueue(): Promise<void>;
  queueAdd(title: string, notes?: string): Promise<void>;
  queueUpdate(id: string, patch: Partial<InternalTask>): Promise<void>;
  queueRemove(id: string): Promise<void>;
  queueRun(id: string, cwd: string): Promise<{ ok: boolean; error?: string }>;
  queueKill(id: string): Promise<void>;
  runningTasks: Set<string>;
  taskOutputs: Record<string, string>;
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
  tasks: null,
  queue: [],
  runningTasks: new Set(),
  taskOutputs: {},
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
      const sid = event.sessionId;
      set((s) => {
        const known = sid ? s.sessions.find((x) => x.id === sid) : null;
        let nextSessions = s.sessions;
        if (sid && !known) {
          // External Claude Code instance discovered via hook bridge — make a ghost card.
          const ghost: SessionInfo = {
            id: sid,
            label: `external · ${sid.slice(0, 8)}`,
            cwd: event.cwd ?? 'unknown',
            pid: 0,
            status: event.hook === 'PreToolUse' ? 'busy' : 'idle',
            lastTool: event.tool,
            lastFile: event.filePath,
            events: 1,
            kind: 'ghost',
            firstSeenAt: event.ts,
            lastEventAt: event.ts
          };
          nextSessions = [...s.sessions, ghost];
        } else if (sid) {
          nextSessions = s.sessions.map((sess) =>
            sess.id === sid
              ? {
                  ...sess,
                  cwd: sess.kind === 'ghost' && event.cwd ? event.cwd : sess.cwd,
                  status: event.hook === 'PreToolUse' ? 'busy' : event.hook === 'PostToolUse' ? 'idle' : sess.status,
                  lastTool: event.tool ?? sess.lastTool,
                  lastFile: event.filePath ?? sess.lastFile,
                  events: sess.events + 1,
                  lastEventAt: event.ts
                }
              : sess
          );
        }
        return {
          events: [event, ...s.events].slice(0, 500),
          sessions: nextSessions
        };
      });
      setTimeout(() => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sid && sess.status === 'busy' ? { ...sess, status: 'idle' } : sess
          )
        }));
      }, STATUS_BUSY_MS);
    });

    await Promise.all([get().refreshScreenshots(), get().refreshVideoJobs(), get().refreshLocks(), get().refreshCost(), get().refreshTasks(), get().refreshQueue()]);

    // Refresh cost periodically — Claude Code logs grow during sessions.
    const costTimer = setInterval(() => { void get().refreshCost(); }, 10_000);
    // Tasks polled more often — that's the live "what is Claude doing" view.
    const tasksTimer = setInterval(() => { void get().refreshTasks(); }, 2_000);
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        clearInterval(costTimer);
        clearInterval(tasksTimer);
      });
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
      events: 0,
      kind: 'pty'
    };
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: s.activeSessionId ?? r.id
    }));
    useNotifications.getState().push({
      kind: 'success',
      title: `session ${opts.label} spawned`,
      body: opts.cwd
    });
    return r.id;
  },

  async killSession(id) {
    const label = get().sessions.find((s) => s.id === id)?.label ?? id.slice(0, 8);
    await window.frame.pty.kill(id);
    set((s) => {
      const remaining = s.sessions.filter((x) => x.id !== id);
      return {
        sessions: remaining,
        activeSessionId: s.activeSessionId === id ? (remaining[0]?.id ?? null) : s.activeSessionId
      };
    });
    useNotifications.getState().push({ kind: 'info', title: `killed ${label}` });
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
  },

  async refreshTasks(hours = 6) {
    const summary = await window.frame.tasks.summary(hours) as TasksSummary;
    set({ tasks: summary });
  },

  async refreshQueue() {
    const list = await window.frame.queue.list();
    set({ queue: list as InternalTask[] });
  },

  async queueAdd(title, notes) {
    await window.frame.queue.add(title, notes);
    await get().refreshQueue();
  },

  async queueUpdate(id, patch) {
    await window.frame.queue.update(id, patch);
    await get().refreshQueue();
  },

  async queueRemove(id) {
    await window.frame.queue.remove(id);
    await get().refreshQueue();
  },

  async queueRun(id, cwd) {
    const r = await window.frame.queue.run(id, cwd);
    if (r.ok) {
      set((s) => {
        const next = new Set(s.runningTasks);
        next.add(id);
        return {
          runningTasks: next,
          taskOutputs: { ...s.taskOutputs, [id]: '' }
        };
      });
      await get().refreshQueue();
      useNotifications.getState().push({
        kind: 'info',
        title: 'background task started',
        body: cwd
      });
      return { ok: true };
    }
    useNotifications.getState().push({ kind: 'error', title: 'failed to start task', body: r.error });
    return { ok: false, error: r.error };
  },

  async queueKill(id) {
    await window.frame.queue.kill(id);
    set((s) => {
      const next = new Set(s.runningTasks);
      next.delete(id);
      return { runningTasks: next };
    });
    await get().refreshQueue();
    useNotifications.getState().push({ kind: 'info', title: 'task killed' });
  }
}));

// Subscribe to runner events at module level — fired once, updates store as events flow.
if (typeof window !== 'undefined' && window.frame) {
  window.frame.queue.onOutput(({ taskId, chunk }) => {
    useWorkspace.setState((s) => ({
      taskOutputs: { ...s.taskOutputs, [taskId]: (s.taskOutputs[taskId] ?? '') + chunk }
    }));
  });
  window.frame.queue.onExit(({ taskId, code, durationMs }) => {
    useWorkspace.setState((s) => {
      const next = new Set(s.runningTasks);
      next.delete(taskId);
      return { runningTasks: next };
    });
    void useWorkspace.getState().refreshQueue();
    useNotifications.getState().push({
      kind: code === 0 ? 'success' : 'warning',
      title: code === 0 ? 'background task done' : `task exited ${code}`,
      body: `${(durationMs / 1000).toFixed(1)}s`
    });
  });
}
