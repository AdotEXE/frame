import { contextBridge, ipcRenderer, webUtils } from 'electron';

type Listener<T> = (payload: T) => void;
const subscribe = <T>(channel: string, fn: Listener<T>): (() => void) => {
  const wrapped = (_e: unknown, payload: T) => fn(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.off(channel, wrapped);
};

export const frameApi = {
  pty: {
    create: (opts: { cwd: string; cols: number; rows: number; label: string }) =>
      ipcRenderer.invoke('pty:create', opts) as Promise<{ id: string; pid: number }>,
    write: (id: string, data: string) => ipcRenderer.invoke('pty:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('pty:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('pty:kill', id),
    list: () => ipcRenderer.invoke('pty:list') as Promise<Array<{ id: string; label: string; cwd: string; pid: number }>>,
    onData: (fn: Listener<{ sessionId: string; data: string }>) => subscribe('pty:data', fn),
    onExit: (fn: Listener<{ sessionId: string; code: number }>) => subscribe('pty:exit', fn)
  },
  clipboard: {
    image: () => ipcRenderer.invoke('clipboard:image') as Promise<string | null>
  },
  screenshots: {
    captureFromClipboard: (label?: string) => ipcRenderer.invoke('screenshot:capture-clipboard', label),
    list: (limit?: number) => ipcRenderer.invoke('screenshot:list', limit),
    read: (id: string) => ipcRenderer.invoke('screenshot:read', id) as Promise<string | null>,
    remove: (id: string) => ipcRenderer.invoke('screenshot:delete', id),
    saveDataUrl: (dataURL: string, label?: string) => ipcRenderer.invoke('screenshot:save-image-data', dataURL, label),
    onNew: (fn: Listener<unknown>) => subscribe('screenshot:new', fn)
  },
  video: {
    select: () => ipcRenderer.invoke('video:select') as Promise<string | null>,
    extract: (filePath: string, opts: { fps: number; width?: number }) =>
      ipcRenderer.invoke('video:extract', filePath, opts) as Promise<{ jobId: string; outDir: string }>,
    zoom: (jobId: string, opts: { startSec: number; endSec: number; fps: number; width: number }) =>
      ipcRenderer.invoke('video:zoom', jobId, opts),
    listJobs: () => ipcRenderer.invoke('video:list-jobs'),
    readFrame: (framePath: string) => ipcRenderer.invoke('video:read-frame', framePath) as Promise<string | null>,
    onProgress: (fn: Listener<{ jobId: string; progress: number }>) => subscribe('video:progress', fn),
    onFrames: (fn: Listener<{ jobId: string; frames: string[] }>) => subscribe('video:frames', fn)
  },
  coord: {
    claim: (sessionId: string, files: string[]) => ipcRenderer.invoke('coord:claim', sessionId, files),
    release: (sessionId: string, files: string[]) => ipcRenderer.invoke('coord:release', sessionId, files),
    state: () => ipcRenderer.invoke('coord:state'),
    onChange: (fn: Listener<unknown>) => subscribe('coord:state', fn)
  },
  hooks: {
    onEvent: (fn: Listener<unknown>) => subscribe('hook:event', fn)
  },
  cost: {
    summary: (hours?: number) => ipcRenderer.invoke('cost:summary', hours) as Promise<{
      inputTokens: number; outputTokens: number; cacheCreate: number; cacheRead: number;
      totalUsdEstimate: number; sessions: number; files: number; windowHours: number;
      lastActivity: number | null;
    }>
  },
  app: {
    paths: () => ipcRenderer.invoke('app:paths') as Promise<{ root: string; screenshots: string; videos: string; data: string }>,
    openFolder: () => ipcRenderer.invoke('app:open-folder') as Promise<string | null>,
    filePathFor: (file: File): string => webUtils.getPathForFile(file)
  }
};

contextBridge.exposeInMainWorld('frame', frameApi);

declare global {
  interface Window { frame: typeof frameApi; }
}
