#!/usr/bin/env node
// Frame launcher — runs cleanup, then `vite`. vite-plugin-electron auto-spawns
// Electron once main.ts has finished building (onstart hook), so no race.
// Records launcher PID so the next invocation can kill the whole tree surgically.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT, '.frame.pid');

// 1. Surgical cleanup of the previous run.
spawnSync(process.execPath, [path.join(__dirname, 'cleanup.cjs')], { stdio: 'inherit' });

// 2. Spawn vite (which spawns Electron via plugin onstart).
const child = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: ROOT
});

// 3. Persist PID for the next cleanup.
fs.writeFileSync(PID_FILE, String(child.pid), 'utf8');
console.log(`[start] pid ${child.pid} -> ${path.basename(PID_FILE)}`);

const wipePid = () => { try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ } };

child.on('exit', (code) => {
  wipePid();
  process.exit(code ?? 0);
});

const forward = (sig) => { try { child.kill(sig); } catch { /* ignore */ } };
process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));
process.on('exit', wipePid);
