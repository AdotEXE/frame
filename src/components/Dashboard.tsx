import { useMemo } from 'react';
import { useWorkspace } from '../store/workspace';

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function Dashboard() {
  const sessions = useWorkspace((s) => s.sessions);
  const events = useWorkspace((s) => s.events);

  const recentBySession = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (!e.sessionId) continue;
      m.set(e.sessionId, (m.get(e.sessionId) ?? 0) + 1);
    }
    return m;
  }, [events]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">AGENT MATRIX</span>
        <span className="panel-meta">{sessions.length} live · {events.length} events</span>
      </div>

      <div className="agent-grid">
        {sessions.length === 0 && <div className="muted">no agents yet — spawn one with + tab</div>}
        {sessions.map((s) => (
          <div key={s.id} className={`agent-card status-${s.status}`}>
            <div className="agent-card-head">
              <span className="agent-dot" />
              <span className="agent-label">{s.label}</span>
              <span className="agent-pid">pid {s.pid}</span>
            </div>
            <div className="agent-cwd" title={s.cwd}>{s.cwd}</div>
            <div className="agent-meta">
              <span>{s.status}</span>
              <span>{recentBySession.get(s.id) ?? 0} evt</span>
            </div>
            {s.lastTool && (
              <div className="agent-tool">
                <span className="agent-tool-label">{s.lastTool}</span>
                {s.lastFile && <span className="agent-tool-file">{s.lastFile}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="panel-head">
        <span className="panel-title">EVENT STREAM</span>
        <span className="panel-meta">live hook feed</span>
      </div>
      <div className="event-stream">
        {events.length === 0 && <div className="muted">waiting for hook events…</div>}
        {events.slice(0, 60).map((e, i) => (
          <div key={i} className="event-row">
            <span className="event-time">{ago(e.ts)}</span>
            <span className="event-hook">{e.hook}</span>
            {e.tool && <span className="event-tool">{e.tool}</span>}
            {e.filePath && <span className="event-file">{e.filePath}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
