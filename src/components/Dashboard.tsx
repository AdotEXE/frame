import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../store/workspace';
import { buildFacts, type Category, type FootprintFact } from '../lib/footprint';
import { TypewriterText, useCountUp } from '../lib/typewriter';

const BUDGET_KEY = 'frame.cost.monthlyBudgetUSD';
const ROTATE_MS = 10000;

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

const CATEGORY_LABEL: Record<Category, string> = {
  nature: 'NATURE',
  tech: 'TECH',
  science: 'SCIENCE',
  salaries: 'SALARIES',
  prices: 'PRICES',
  world: 'WORLD'
};

const CATEGORY_COLOR: Record<Category, string> = {
  nature: 'var(--accent)',
  tech: 'var(--accent-2)',
  science: 'var(--busy)',
  salaries: 'var(--warn)',
  prices: '#ff8a8a',
  world: '#62a0ff'
};

const CATEGORIES: Category[] = ['nature', 'tech', 'science', 'salaries', 'prices', 'world'];

export function Dashboard() {
  const sessions = useWorkspace((s) => s.sessions);
  const events = useWorkspace((s) => s.events);
  const cost = useWorkspace((s) => s.cost);
  const refreshCost = useWorkspace((s) => s.refreshCost);

  const [budget, setBudget] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(BUDGET_KEY) ?? '');
    return isFinite(v) && v > 0 ? v : 200;
  });
  const [factIndex, setFactIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Set<Category>>(new Set(CATEGORIES));

  const allFacts = useMemo(() => (cost ? buildFacts(cost) : []), [cost]);
  const facts = useMemo(() => allFacts.filter((f) => categoryFilter.has(f.category)), [allFacts, categoryFilter]);

  function toggleCategory(c: Category) {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      if (next.size === 0) return new Set(CATEGORIES);
      return next;
    });
    setFactIndex(0);
  }

  useEffect(() => {
    if (paused || facts.length === 0) return;
    const t = setInterval(() => setFactIndex((i) => (i + 1) % facts.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, facts.length]);

  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, String(budget));
  }, [budget]);

  const recentBySession = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (!e.sessionId) continue;
      m.set(e.sessionId, (m.get(e.sessionId) ?? 0) + 1);
    }
    return m;
  }, [events]);

  const sessionLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sessions) m.set(s.id, s.label);
    return m;
  }, [sessions]);

  // Project the active window cost up to a 30-day estimate so the budget bar makes sense.
  const monthlyProjection = cost && cost.windowHours > 0
    ? cost.totalUsdEstimate * (24 * 30 / cost.windowHours)
    : 0;
  const budgetPct = budget > 0 ? Math.min(999, (monthlyProjection / budget) * 100) : 0;
  const budgetColor = budgetPct < 60 ? 'var(--accent)' : budgetPct < 100 ? 'var(--warn)' : 'var(--err)';

  const fact: FootprintFact | null = facts[factIndex] ?? null;

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
            <CostTotal value={cost.totalUsdEstimate} />
          </div>
          <div className="cost-grid">
            <div className="cost-cell"><span>in</span><b>{fmtTokens(cost.inputTokens)}</b></div>
            <div className="cost-cell"><span>out</span><b>{fmtTokens(cost.outputTokens)}</b></div>
            <div className="cost-cell"><span>cache wr</span><b>{fmtTokens(cost.cacheCreate)}</b></div>
            <div className="cost-cell"><span>cache rd</span><b>{fmtTokens(cost.cacheRead)}</b></div>
            <div className="cost-cell"><span>files</span><b>{cost.files}</b></div>
            <div className="cost-cell"><span>last</span><b>{cost.lastActivity ? ago(cost.lastActivity) : '—'}</b></div>
          </div>

          <div className="budget-block">
            <div className="budget-row">
              <span className="budget-label">monthly budget</span>
              <input
                className="budget-input"
                type="number"
                min={1}
                step={10}
                value={budget}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (isFinite(v) && v > 0) setBudget(v);
                }}
              />
              <span className="budget-projection">~${monthlyProjection.toFixed(0)}/mo at this rate</span>
            </div>
            <div className="budget-bar">
              <div className="budget-bar-fill" style={{ width: `${Math.min(100, budgetPct)}%`, background: budgetColor, boxShadow: `0 0 8px ${budgetColor}` }} />
              <span className="budget-bar-pct" style={{ color: budgetColor }}>{budgetPct.toFixed(0)}%</span>
            </div>
            <div className="budget-disclaimer">
              API-equivalent estimate · per-turn model rates (Opus / Sonnet / Haiku) · your actual plan billing (Max / Pro / Team) may differ
            </div>
          </div>

          <div className="footprint-filter">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`footprint-chip ${categoryFilter.has(c) ? 'on' : 'off'}`}
                style={{ borderColor: categoryFilter.has(c) ? CATEGORY_COLOR[c] : 'var(--line)', color: categoryFilter.has(c) ? CATEGORY_COLOR[c] : 'var(--fg-mute)' }}
                onClick={() => toggleCategory(c)}
              >
                {CATEGORY_LABEL[c].toLowerCase()}
              </button>
            ))}
          </div>

          {fact && (
            <div
              className={`footprint-fact tone-${fact.tone}`}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              title={`source: ${fact.source}`}
            >
              <div className="footprint-head">
                <span className="footprint-icon">{fact.icon}</span>
                <span className="footprint-cat" style={{ color: CATEGORY_COLOR[fact.category] }}>
                  {CATEGORY_LABEL[fact.category]}
                </span>
                <span className="footprint-counter">{factIndex + 1} / {facts.length}</span>
              </div>
              <div className="footprint-text">
                <TypewriterText key={`${factIndex}:${fact.text}`} text={fact.text} speedMs={14} />
              </div>
              <div className="footprint-source">src: {fact.source}</div>
              <div className="footprint-nav">
                <button className="btn subtle small" onClick={() => setFactIndex((i) => (i - 1 + facts.length) % facts.length)}>‹</button>
                <button className="btn subtle small" onClick={() => setPaused((p) => !p)}>{paused ? '▶ play' : '⏸ pause'}</button>
                <button className="btn subtle small" onClick={() => setFactIndex((i) => (i + 1) % facts.length)}>›</button>
              </div>
            </div>
          )}

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
        <span className="panel-meta">
          {sessions.filter((s) => s.kind === 'pty').length} local · {sessions.filter((s) => s.kind === 'ghost').length} external · {events.length} events
        </span>
      </div>

      <div className="agent-grid">
        {sessions.length === 0 && <div className="muted">no agents yet — spawn with + or wait for external Claude events</div>}
        {sessions.map((s) => (
          <div key={s.id} className={`agent-card status-${s.status} kind-${s.kind}`}>
            <div className="agent-card-head">
              <span className="agent-dot" />
              <span className="agent-label">{s.label}</span>
              {s.kind === 'pty' ? (
                <span className="agent-pid">pid {s.pid}</span>
              ) : (
                <span className="agent-pid agent-ghost-tag">external</span>
              )}
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
        {events.slice(0, 60).map((e, i) => {
          const label = e.sessionId ? sessionLabelById.get(e.sessionId) : null;
          const isNewest = i === 0;
          return (
            <div key={`${e.ts}-${i}`} className="event-row">
              <span className="event-time">{ago(e.ts)}</span>
              {label && <span className="event-session" title={e.sessionId}>{label}</span>}
              <span className="event-hook">{e.hook}</span>
              {e.tool && (
                isNewest
                  ? <TypewriterText className="event-tool" text={e.tool} speedMs={20} cursor={false} />
                  : <span className="event-tool">{e.tool}</span>
              )}
              {e.filePath && (
                isNewest
                  ? <TypewriterText className="event-file" text={e.filePath} speedMs={8} cursor={false} />
                  : <span className="event-file">{e.filePath}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CostTotal({ value }: { value: number }) {
  const animated = useCountUp(value, 700);
  return <span className="cost-value-big">{fmtUsd(animated)}</span>;
}
