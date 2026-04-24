# Frame Mobile

Tiny static SPA served by Frame's HTTP API at `http://<frame-host>:47822/mobile/`.

## How to use

1. Frame must be running on your desktop.
2. On your phone's browser: `http://<desktop-lan-ip-or-tailscale-name>:47822/mobile/`
3. Chrome on Android / Safari on iOS: add to home screen for standalone PWA look.

## Features

- **DASH** — last 24h cost summary + quick counters (local sessions, running agents, queued tasks).
- **QUEUE** — live list of pending/in-progress tasks. Add new tasks via text input or dictate with the 🎤 button (Web Speech API).
- **AGENTS** — local PTY sessions + every external Claude currently running a tool.

Auto-refreshes every 4s while foregrounded.

## Install as PWA

Chrome/Edge on Android: top-right menu → "Add to Home screen". Standalone window opens, looks like a native app.

Safari iOS: share sheet → "Add to Home Screen".

## Networking

Frame binds the API on `0.0.0.0:47822` — reachable over LAN and over Tailscale if you have it. CORS is permissive (`*`) on all origins.

For safer remote access:
- Use Tailscale (`frame.your-tailnet.ts.net`) rather than exposing to the open internet.
- Future: add bearer-token auth + TLS proxy if you need public URL.

## Limits

- No push notifications yet (Web Push setup requires VAPID keys + Frame sending pushes; planned v0.3+).
- No offline mode — disconnection shows the red ● indicator; UI still renders last-known data.
- No MCP proxy from the PWA — it's a read-mostly companion, not a command center.
