import { app, BrowserWindow, ipcMain, clipboard, nativeImage, globalShortcut, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PtyManager } from './pty-manager.js';
import { ScreenshotStore } from './screenshot-store.js';
import { VideoPipeline } from './video-pipeline.js';
import { Coordinator } from './coordinator.js';
import { HookListener } from './hook-listener.js';
import { FramePaths } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let pty: PtyManager;
let screenshots: ScreenshotStore;
let video: VideoPipeline;
let coordinator: Coordinator;
let hookListener: HookListener;

const VITE_DEV_URL = process.env.VITE_DEV_SERVER_URL;

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
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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

  // ---- IPC: Coordinator ----
  ipcMain.handle('coord:claim', (_e, sessionId: string, files: string[]) => coordinator.claim(sessionId, files));
  ipcMain.handle('coord:release', (_e, sessionId: string, files: string[]) => coordinator.release(sessionId, files));
  ipcMain.handle('coord:state', () => coordinator.snapshot());

  // ---- IPC: Misc ----
  ipcMain.handle('app:paths', () => FramePaths.all());
  ipcMain.handle('app:open-folder', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
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
