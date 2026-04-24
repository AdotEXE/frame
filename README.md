# Frame

Unified workspace for Claude Code — multiple sessions, screenshot vault, video→frames pipeline, file-lock coordination, agent dashboard. All in one Electron window.

## What's in the box

1. **Multi-session terminals** — spawn N shells, switch tabs. Run `claude` in each.
2. **Screenshot vault** — auto-grabs clipboard images, hotkey `Ctrl+Shift+S`, SQLite-indexed history with previews.
3. **Video → frames** — pick an MP4, choose base fps + width, ffmpeg extracts. Then **zoom-in pass**: re-extract any time range at higher fps + resolution.
4. **File-lock coordination** — when one session's Claude is editing `foo.ts`, every other session sees the lock in real time. Auto-claimed via PreToolUse hook bridge.
5. **Agent dashboard** — every session card with live status, last tool, last file. Hook event stream below.

## Stack

- Electron 33 + Vite 5 + React 18 + TypeScript
- `node:sqlite` (built into Node 22+ — no native build)
- `child_process` shells (no native build for v0.1) — see **PTY upgrade** below
- xterm.js, ffmpeg-static, fluent-ffmpeg, Zustand

## Setup

```bash
cd frame
npm install
npm run electron:dev
```

That's it. **No Visual Studio Build Tools needed** for v0.1.

## Layout

```
┌──── header ───────────────────────────────────────────────┐
│ ▍FRAME                              ● 3 live      │
├────┬─────────────────────────────────────┬────────────────┤
│ ▤  │ ▌ session-1  Edit  ⌃ session-2 …  + │ AGENT MATRIX   │
│ ◰  │                                     │ ● session-1    │
│ ▶  │   shell terminal                    │ ● session-2    │
│ ⛬  │                                     │ EVENT STREAM   │
└────┴─────────────────────────────────────┴────────────────┘
```

Left rail: **Agents**, **Snaps**, **Video**, **Locks**.

## Wire Claude Code → Frame dashboard

See `HOOKS_SETUP.md`. Short version: Frame listens on `127.0.0.1:47821` and drops a bridge script at `%APPDATA%\frame\frame\frame-hook.cjs` on first launch. Add four hook entries to `~/.claude/settings.json` (PreToolUse, PostToolUse, SessionStart, SessionEnd) → status flips, locks claim, events stream.

## Data lives in

`%APPDATA%\frame\frame\`
- `screenshots/*.png`
- `videos/<jobId>/pass-N-{base|zoom}/frame_xxxxx.png`
- `data/screenshots.db` and `data/coordinator.db` (SQLite)
- `frame-hook.cjs`

## PTY upgrade (real terminal for Claude Code TUI)

v0.1 uses `child_process.spawn` for shells — works for commands, but Claude Code's curses-style TUI (cursor positioning, raw mode) won't render correctly. To upgrade to a real PTY:

1. Install **Visual Studio Build Tools 2022** (NOT 2026): https://visualstudio.microsoft.com/downloads/?q=build+tools — pick "Desktop development with C++". One-time, ~6GB.
2. `npm install node-pty`
3. Swap `electron/pty-manager.ts` to use `import * as pty from 'node-pty'` (the previous PTY-based version is in git history — see commit 1).
4. Restart Frame.

> Why VS 2022 not 2026: `node-gyp 9.x` (used by `node-pty 1.0`) doesn't recognize VS Build Tools v18 (released Feb 2026). Either install older VS BT, or upgrade `node-gyp` globally to 11+.

## Roadmap

- v0.1 — MVP scaffold, every system wired, runs without native build
- v0.2 — drag-and-drop video, frame thumbnail strip, copy-to-Claude path button
- v0.3 — token/cost meter from Claude Code JSONL logs (`%APPDATA%\Claude\sessions\*`)
- v0.4 — auto-paste image-path into active terminal
- v0.5 — proper PTY (node-pty) once VS Build Tools are present
