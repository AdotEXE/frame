import { app, BrowserWindow, ipcMain, clipboard, nativeImage, globalShortcut, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PtyManager } from './pty-manager.js';
import { ScreenshotStore } from './screenshot-store.js';
import { VideoPipeline } from './video-pipeline.js';
import { Coordinator } from './coordinator.js';
import { HookListener } from './hook-listener.js';
import { FramePaths } from './paths.js';
import { CostScanner } from './cost-scanner.js';
import { TasksScanner } from './tasks-scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let pty: PtyManager;
let screenshots: ScreenshotStore;
let video: VideoPipeline;
let coordinator: Coordinator;
let hookListener: HookListener;
let cost: CostScanner;
let tasks: TasksScanner;

const VITE_DEV_URL = process.env.VITE_DEV_SERVER_URL;

// Vite dev needs 'unsafe-eval' for HMR — Electron prints a security warning
// every reload because of it. The packaged build does NOT need unsafe-eval
// (chunked output), so the warning is dev-only noise. Suppress only in dev.
if (VITE_DEV_URL) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0e14',
    title: 'Frame',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (VITE_DEV_URL) {
    mainWindow.loadURL(VITE_DEV_URL);
    // DevTools open on demand (F12 / Ctrl+Shift+I), not by default.
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function bootstrap(): Promise<void> {
  await FramePaths.ensure();

  pty = new PtyManager({
    onData: (sessionId, data) => send('pty:data', { sessionId, data }),
    onExit: (sessionId, code) => send('pty:exit', { sessionId, code })
  });

  screenshots = new ScreenshotStore({
    onCapture: (entry) => send('screenshot:new', entry)
  });
  await screenshots.init();
  screenshots.startClipboardWatcher();

  video = new VideoPipeline({
    onProgress: (jobId, progress) => send('video:progress', { jobId, progress }),
    onFrames: (jobId, frames) => send('video:frames', { jobId, frames })
  });

  coordinator = new Coordinator({
    onLockChange: (state) => send('coord:state', state)
  });
  await coordinator.init();

  hookListener = new HookListener({
    onEvent: (event) => {
      send('hook:event', event);
      coordinator.applyHookEvent(event);
    }
  });
  await hookListener.start();

  // ---- IPC: PTY sessions ----
  ipcMain.handle('pty:create', (_e, opts: { cwd: string; cols: number; rows: number; label: string }) => {
    return pty.spawn(opts);
  });
  ipcMain.handle('pty:write', (_e, sessionId: string, data: string) => pty.write(sessionId, data));
  ipcMain.handle('pty:resize', (_e, sessionId: string, cols: number, rows: number) => pty.resize(sessionId, cols, rows));
  ipcMain.handle('pty:kill', (_e, sessionId: string) => pty.kill(sessionId));
  ipcMain.handle('pty:list', () => pty.list());
  ipcMain.handle('pty:get-buffer', (_e, sessionId: string) => pty.getBuffer(sessionId));

  // ---- IPC: Clipboard / screenshots ----
  ipcMain.handle('clipboard:image', () => {
    const img = clipboard.readImage();
    if (img.isEmpty()) return null;
    return img.toDataURL();
  });
  ipcMain.handle('screenshot:capture-clipboard', async (_e, label?: string) => {
    return screenshots.captureFromClipboard(label);
  });
  ipcMain.handle('screenshot:list', (_e, limit?: number) => screenshots.list(limit));
  ipcMain.handle('screenshot:read', (_e, id: string) => screenshots.read(id));
  ipcMain.handle('screenshot:delete', (_e, id: string) => screenshots.remove(id));
  ipcMain.handle('screenshot:save-image-data', (_e, dataURL: string, label?: string) => {
    const img = nativeImage.createFromDataURL(dataURL);
    return screenshots.saveImage(img.toPNG(), label);
  });
  ipcMain.handle('screenshot:thumb', async (_e, id: string, maxWidth = 240) => {
    const fullPath = await screenshots.pathOf(id);
    if (!fullPath) return null;
    try {
      const img = nativeImage.createFromPath(fullPath);
      if (img.isEmpty()) return null;
      const resized = img.resize({ width: maxWidth, quality: 'good' });
      return `data:image/png;base64,${resized.toPNG().toString('base64')}`;
    } catch {
      return null;
    }
  });

  // ---- IPC: Video ----
  ipcMain.handle('video:select', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi'] }]
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('video:extract', (_e, filePath: string, opts: { fps: number; width?: number }) => {
    return video.extractFrames(filePath, opts);
  });
  ipcMain.handle('video:zoom', (_e, jobId: string, opts: { startSec: number; endSec: number; fps: number; width: number }) => {
    return video.zoomIn(jobId, opts);
  });
  ipcMain.handle('video:list-jobs', () => video.listJobs());
  ipcMain.handle('video:read-frame', async (_e, framePath: string) => {
    try {
      const fs = await import('node:fs/promises');
      const buf = await fs.readFile(framePath);
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  });

  // ---- IPC: Coordinator ----
  ipcMain.handle('coord:claim', (_e, sessionId: string, files: string[]) => coordinator.claim(sessionId, files));
  ipcMain.handle('coord:release', (_e, sessionId: string, files: string[]) => coordinator.release(sessionId, files));
  ipcMain.handle('coord:state', () => coordinator.snapshot());

  cost = new CostScanner();
  ipcMain.handle('cost:summary', (_e, hours?: number) => cost.summary(hours ?? 24));

  tasks = new TasksScanner();
  ipcMain.handle('tasks:summary', (_e, hours?: number) => tasks.summary(hours ?? 6));

  // ---- IPC: Misc ----
  ipcMain.handle('app:paths', () => FramePaths.all());
  ipcMain.handle('app:open-folder', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('app:resolve-cwd', async (_e, p: string) => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const stat = await fs.stat(p);
      const cwd = stat.isDirectory() ? p : path.dirname(p);
      return { cwd, label: path.basename(cwd) || cwd };
    } catch {
      return null;
    }
  });
}

app.whenReady().then(async () => {
  await bootstrap();
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+S', async () => {
    const entry = await screenshots.captureFromClipboard('hotkey');
    if (entry) send('screenshot:new', entry);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  pty?.disposeAll();
  screenshots?.dispose();
  video?.dispose();
  coordinator?.dispose();
  hookListener?.dispose();
});
