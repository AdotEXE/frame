import { useEffect, useState } from 'react';
import { useWorkspace } from '../store/workspace';

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
}

function fmtMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function ago(ts: number | null): string {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function StatusBar() {
  const sessions = useWorkspace((s) => s.sessions);
  const queue = useWorkspace((s) => s.queue);
  const cost = useWorkspace((s) => s.cost);
  const events = useWorkspace((s) => s.events);
  const tasks = useWorkspace((s) => s.tasks);
  const [mem, setMem] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setTick((x) => x + 1);
      const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
      if (perf.memory) setMem(perf.memory.usedJSHeapSize);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const local = sessions.filter((s) => s.kind === 'pty').length;
  const ghost = sessions.filter((s) => s.kind === 'ghost').length;
  const pending = queue.filter((t) => t.status === 'pending').length;
  const inProgress = queue.filter((t) => t.status === 'in-progress').length;
  const lastEventAt = events[0]?.ts ?? null;
  const liveTaskAgents = tasks?.agents.filter((a) => a.inflightTool).length ?? 0;

  return (
    <footer className="frame-statusbar">
      <span className="sb-cell">
        <span className="sb-dot ok" />
        <span className="sb-label">{local} local</span>
        {ghost > 0 && <span className="sb-sep">·</span>}
        {ghost > 0 && <span className="sb-label muted">{ghost} ext</span>}
      </span>

      <span className="sb-cell">
        <span className={`sb-dot ${liveTaskAgents > 0 ? 'busy' : 'idle'}`} />
        <span className="sb-label">{liveTaskAgents} running</span>
      </span>

      <span className="sb-cell">
        <span className="sb-glyph">▦</span>
        <span className="sb-label">{pending} queue</span>
        {inProgress > 0 && <span className="sb-label busy">+{inProgress} wip</span>}
      </span>

      <span className="sb-spacer" />

      {cost && (
        <span className="sb-cell" title={`API-equivalent estimate · last ${cost.windowHours}h`}>
          <span className="sb-glyph">$</span>
          <span className="sb-label">{fmtUsd(cost.totalUsdEstimate)}</span>
          <span className="sb-label muted">/{cost.windowHours}h</span>
        </span>
      )}

      <span className="sb-cell" title="renderer JS heap">
        <span className="sb-glyph">⚙</span>
        <span className="sb-label">{fmtMb(mem)}</span>
      </span>

      <span className="sb-cell" title={lastEventAt ? new Date(lastEventAt).toLocaleString() : 'no events yet'}>
        <span className="sb-glyph">⚡</span>
        <span className="sb-label">last evt {ago(lastEventAt)}</span>
      </span>
    </footer>
  );
}
