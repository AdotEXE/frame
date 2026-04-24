#!/usr/bin/env node
// Frame cleanup — two-stage:
//   1) PID-file based: kills the previous launcher tree by recorded PID.
//   2) Legacy fallback: PowerShell sweep for orphan electron.exe whose
//      ExecutablePath is inside frame. Explicitly skips processes
//      listening on Protocol XT protected ports (5001 / 8000 / 9000).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT, '.frame.pid');

function killByPidFile() {
  if (!fs.existsSync(PID_FILE)) return false;
  let raw;
  try { raw = fs.readFileSync(PID_FILE, 'utf8').trim(); }
  catch { return false; }
  const pid = parseInt(raw, 10);
  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
  if (!Number.isFinite(pid) || pid <= 0) return false;
  if (pid === process.pid || pid === process.ppid) {
    console.log(`[cleanup] pid ${pid} is myself or parent — refusing`);
    return false;
  }
  console.log(`[cleanup] killing pid tree ${pid} from previous run…`);
  const r = spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'inherit' });
  if (r.status === 0) console.log('[cleanup] tree killed');
  else console.log(`[cleanup] taskkill exit ${r.status} — likely already gone`);
  return true;
}

function legacySweep() {
  const ps = path.join(__dirname, 'cleanup.ps1');
  if (!fs.existsSync(ps)) return;
  spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps], { stdio: 'inherit' });
}

killByPidFile();
legacySweep();
process.exit(0);
