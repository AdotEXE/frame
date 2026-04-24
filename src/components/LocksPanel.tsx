import { useEffect } from 'react';
import { useWorkspace } from '../store/workspace';

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function LocksPanel() {
  const locks = useWorkspace((s) => s.locks);
  const sessions = useWorkspace((s) => s.sessions);
  const refresh = useWorkspace((s) => s.refreshLocks);

  useEffect(() => { void refresh(); }, [refresh]);

  function labelFor(sid: string): string {
    return sessions.find((s) => s.id === sid)?.label ?? sid.slice(0, 8);
  }

  async function releaseAll(sid: string) {
    await window.frame.coord.release(sid, []);
    await refresh();
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">FILE LOCK MAP</span>
        <span className="panel-meta">{locks.files.length} active claim{locks.files.length === 1 ? '' : 's'}</span>
      </div>
      <div className="panel-actions">
        <button className="btn subtle" onClick={refresh}>↻ Refresh</button>
      </div>

      {locks.files.length === 0 && <div className="muted">no files held — agents are free to roam</div>}

      <div className="lock-list">
        {locks.files.map((f) => (
          <div key={`${f.path}|${f.sessionId}`} className="lock-row">
            <div className="lock-file" title={f.path}>{f.path}</div>
            <div className="lock-meta">
              <span className="lock-holder">{labelFor(f.sessionId)}</span>
              <span className="lock-since">{ago(f.sinceMs)}</span>
              <button className="btn subtle small" onClick={() => releaseAll(f.sessionId)}>release</button>
            </div>
          </div>
        ))}
      </div>

      <div className="hint-box">
        <div className="hint-title">how locks get set</div>
        <div className="hint-text">
          Each Claude Code session running through Frame auto-claims a file when it issues an Edit/Write/NotebookEdit
          tool call (via the PreToolUse hook bridge in <code>~/.claude-data/frame-hook.cjs</code>). Lock is released on
          PostToolUse or when the session ends. Wire up via the README.
        </div>
      </div>
    </div>
  );
}
