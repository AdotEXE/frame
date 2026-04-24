# Wire Claude Code → Frame Dashboard

Frame listens on `127.0.0.1:47821` for hook events. To make every Claude Code session you run report into the dashboard, add this to your **global** Claude Code settings.

## Step 1 — Verify the bridge script exists

After first launch, Frame drops a Node bridge script at:

```
%APPDATA%\frame\frame\frame-hook.cjs
```

(On Windows that resolves to `C:\Users\<you>\AppData\Roaming\frame\frame\frame-hook.cjs`.)

If it's missing, launch Frame at least once.

## Step 2 — Edit `~/.claude/settings.json`

Merge this into your existing settings (preserve any other hooks you have):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          { "type": "command", "command": "node \"%APPDATA%\\frame\\frame\\frame-hook.cjs\"" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          { "type": "command", "command": "node \"%APPDATA%\\frame\\frame\\frame-hook.cjs\"" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node \"%APPDATA%\\frame\\frame\\frame-hook.cjs\"" }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          { "type": "command", "command": "node \"%APPDATA%\\frame\\frame\\frame-hook.cjs\"" }
        ]
      }
    ]
  }
}
```

## Step 3 — Test

1. Open Frame.
2. New session in any folder.
3. Run `claude` in the terminal.
4. Ask Claude to read or edit a file.
5. Watch the **Agents** dashboard — status flips to `busy`, last tool/file shows up, event stream populates.

## What gets shared between sessions

When session A's Claude calls `Edit foo.ts`, the PreToolUse hook fires → Frame's coordinator claims `foo.ts` for that session in SQLite. Session B's UI shows the lock immediately in the **Locks** panel. PostToolUse releases it. SessionEnd releases everything that session held.

## Bridge script content

The script just pipes the JSON payload Claude Code sends on stdin to `http://127.0.0.1:47821/hook`. Failure-tolerant: if Frame isn't running, the hook exits silently — your Claude session is unaffected.
