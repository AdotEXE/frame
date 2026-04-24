import { useMemo } from 'react';
import { useWorkspace } from '../store/workspace';

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  if (n >= 100) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
}

export function Dashboard() {
  const sessions = useWorkspace((s) => s.sessions);
  const events = useWorkspace((s) => s.events);
  const cost = useWorkspace((s) => s.cost);
  const refreshCost = useWorkspace((s) => s.refreshCost);

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
        <span className="panel-title">COST METER</span>
        <span className="panel-meta">last {cost?.windowHours ?? 24}h · est USD</span>
      </div>
      {!cost && <div className="muted">scanning ~/.claude/projects…</div>}
      {cost && (
        <div className="cost-meter">
          <div className="cost-row primary">
            <span className="cost-label">total</span>
            <span className="cost-value-big">{fmtUsd(cost.totalUsdEstimate)}</span>
          </div>
          <div className="cost-grid">
            <div className="cost-cell"><span>in</span><b>{fmtTokens(cost.inputTokens)}</b></div>
            <div className="cost-cell"><span>out</span><b>{fmtTokens(cost.outputTokens)}</b></div>
            <div className="cost-cell"><span>cache wr</span><b>{fmtTokens(cost.cacheCreate)}</b></div>
            <div className="cost-cell"><span>cache rd</span><b>{fmtTokens(cost.cacheRead)}</b></div>
            <div className="cost-cell"><span>files</span><b>{cost.files}</b></div>
            <div className="cost-cell"><span>last</span><b>{cost.lastActivity ? ago(cost.lastActivity) : '—'}</b></div>
          </div>
          <div className="cost-actions">
            <button className="btn subtle small" onClick={() => refreshCost(1)}>1h</button>
            <button className="btn subtle small" onClick={() => refreshCost(24)}>24h</button>
            <button className="btn subtle small" onClick={() => refreshCost(24 * 7)}>7d</button>
            <button className="btn subtle small" onClick={() => refreshCost(24 * 30)}>30d</button>
          </div>
        </div>
      )}

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
