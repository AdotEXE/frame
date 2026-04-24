# Frame MCP Bridge

Lets any Claude Code session control Frame in natural language: "spawn 3 sessions in /a /b /c", "kill idle frame-2", "add to queue: refactor cost-scanner", "what is each Claude doing right now".

## How it works

```
┌──────────────────┐  stdio JSON-RPC   ┌──────────────────┐  HTTP   ┌─────────┐
│ Claude Code CLI  │ ←──────────────→  │ mcp-bridge.cjs   │ ←──→    │  Frame  │
│ (any terminal)   │                   │ (your machine)   │ :47822  │ Electron│
└──────────────────┘                   └──────────────────┘         └─────────┘
```

- **Frame** runs an HTTP API on `127.0.0.1:47822` whenever the app is open.
- **`scripts/mcp-bridge.cjs`** is a tiny Node script that speaks the MCP stdio protocol on stdin/stdout and proxies tool calls to that HTTP API.
- **Claude Code** invokes the bridge per its `mcpServers` config and gets a set of `frame_*` tools.

## Setup (one-time)

Add to your global Claude Code settings at `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "frame": {
      "command": "node",
      "args": ["C:\\Users\\PC\\Desktop\\frame\\scripts\\mcp-bridge.cjs"]
    }
  }
}
```

Reload your Claude Code session. Type `/mcp` — `frame` should be listed and connected.

## Tools exposed

| Tool | Purpose |
|---|---|
| `frame_list_sessions` | List Frame PTY shells |
| `frame_spawn_session` | New shell in given cwd / label |
| `frame_kill_session` | Kill by id |
| `frame_send_input` | Type into a session |
| `frame_get_buffer` | Recent stdout (~200 KB ring) |
| `frame_queue_list` | Internal task queue |
| `frame_queue_add` | Add task |
| `frame_queue_update` | Change status (pending / in-progress / done) or text |
| `frame_queue_remove` | Delete task |
| `frame_get_tasks` | Snapshot of every Claude agent Frame can see (own + external via hooks) |
| `frame_get_cost` | Token + USD summary for last N hours |
| `frame_list_screenshots` | Screenshot vault listing |
| `frame_capture_clipboard_screenshot` | Save current clipboard image to vault |
| `frame_get_locks` | File-lock state across agents |
| `frame_set_panel` | Switch right panel (dashboard / tasks / screenshots / video / locks) |

## Example usage

After wiring it up, in any Claude Code terminal:

> spawn three sessions in C:\\dev\\foo, C:\\dev\\bar, C:\\dev\\baz with labels "frontend", "backend", "tests"

> add to my Frame queue: review v0.2.6 PR, refactor cost-scanner, write README screenshots

> what is every running Claude doing right now? group by project.

> kill any Frame session whose label starts with "tmp-"

## Notes

- Frame must be running for the bridge to work — bridge fails fast on connection refused.
- Bridge has no auth; HTTP server binds only to `127.0.0.1`. Don't expose 47822 to the network.
- All endpoints are also reachable directly via `curl http://127.0.0.1:47822/api/...` for shell scripts and external tools.
- Bridge has no Frame-side dependency — pure Node, runs anywhere Node 16+ is installed.
