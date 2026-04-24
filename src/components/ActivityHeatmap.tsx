import { useEffect, useMemo, useState } from 'react';

type Metric = 'usd' | 'tools' | 'tokens';

interface Cell {
  dayOffset: number;
  hour: number;
  usd: number;
  tokens: number;
  tools: number;
  sessionIds: string[];
}

interface HeatmapData {
  cells: Cell[];
  days: number;
  startDayMs: number;
  scannedAt: number;
}

const CELL = 11;
const GAP = 2;
const HOURS = 24;

function fmtVal(v: number, m: Metric): string {
  if (m === 'usd') return v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(3)}`;
  if (m === 'tokens') {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  }
  return String(Math.round(v));
}

export function ActivityHeatmap() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<Metric>('usd');
  const [hover, setHover] = useState<{ cell: Cell; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.frame.history.heatmap(days).then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [days]);

  const max = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.cells.map((c) => c[metric]));
  }, [data, metric]);

  const cellMap = useMemo(() => {
    const m = new Map<string, Cell>();
    if (data) for (const c of data.cells) m.set(`${c.dayOffset}:${c.hour}`, c);
    return m;
  }, [data]);

  if (!data) return <div className="panel"><div className="muted">scanning history…</div></div>;

  const w = days * (CELL + GAP) + 30;
  const h = HOURS * (CELL + GAP) + 18;

  function dateOf(dayOffset: number): string {
    const ms = data!.startDayMs + (data!.days - 1 - dayOffset) * 86_400_000;
    return new Date(ms).toLocaleDateString();
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">ACTIVITY HEATMAP</span>
        <span className="panel-meta">last {data.days} days · hour × day · {data.cells.length} cells</span>
      </div>
      <div className="panel-actions">
        <button className={`btn subtle small ${metric === 'usd' ? 'active' : ''}`} onClick={() => setMetric('usd')}>$ usd</button>
        <button className={`btn subtle small ${metric === 'tools' ? 'active' : ''}`} onClick={() => setMetric('tools')}>tool calls</button>
        <button className={`btn subtle small ${metric === 'tokens' ? 'active' : ''}`} onClick={() => setMetric('tokens')}>tokens</button>
        <span style={{ flex: 1 }} />
        <button className={`btn subtle small ${days === 7 ? 'active' : ''}`} onClick={() => setDays(7)}>7d</button>
        <button className={`btn subtle small ${days === 30 ? 'active' : ''}`} onClick={() => setDays(30)}>30d</button>
        <button className={`btn subtle small ${days === 90 ? 'active' : ''}`} onClick={() => setDays(90)}>90d</button>
      </div>

      <div className="hm-wrap" style={{ position: 'relative' }}>
        <svg width={w} height={h} className="hm-svg">
          {/* hour labels (every 4) */}
          {Array.from({ length: HOURS }, (_, hr) => (
            hr % 4 === 0 ? (
              <text key={`hl-${hr}`} x={2} y={hr * (CELL + GAP) + CELL / 2 + 3} className="hm-label">{hr}</text>
            ) : null
          ))}
          <g transform="translate(20, 0)">
            {Array.from({ length: days }, (_, i) => {
              // i = 0 → leftmost = oldest day; rightmost = today.
              const dayOffset = days - 1 - i;
              return Array.from({ length: HOURS }, (_, hr) => {
                const cell = cellMap.get(`${dayOffset}:${hr}`);
                const v = cell ? cell[metric] : 0;
                const intensity = v / max;
                return (
                  <rect
                    key={`c-${i}-${hr}`}
                    x={i * (CELL + GAP)}
                    y={hr * (CELL + GAP)}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    fill={intensity > 0
                      ? `color-mix(in srgb, var(--accent) ${Math.max(8, intensity * 100)}%, var(--bg-2))`
                      : 'var(--bg-2)'}
                    stroke="var(--line-soft)"
                    strokeWidth={0.4}
                    style={{ cursor: cell ? 'pointer' : 'default' }}
                    onMouseEnter={(e) => {
                      if (!cell) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHover({ cell, x: rect.right + 6, y: rect.top });
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              });
            })}
          </g>
          {/* day-of-month labels along bottom every ~7 days */}
          {Array.from({ length: days }, (_, i) => {
            if (i % Math.max(1, Math.floor(days / 8)) !== 0) return null;
            const dayOffset = days - 1 - i;
            const ms = data.startDayMs + (data.days - 1 - dayOffset) * 86_400_000;
            const d = new Date(ms);
            return (
              <text key={`dl-${i}`} x={20 + i * (CELL + GAP)} y={HOURS * (CELL + GAP) + 12} className="hm-label">
                {d.getDate()}/{d.getMonth() + 1}
              </text>
            );
          })}
        </svg>
        {hover && (
          <div className="hm-tooltip" style={{ left: hover.x, top: hover.y }}>
            <div><b>{dateOf(hover.cell.dayOffset)} · {hover.cell.hour.toString().padStart(2, '0')}:00</b></div>
            <div>{fmtVal(hover.cell.usd, 'usd')} · {fmtVal(hover.cell.tools, 'tools')} tool calls · {fmtVal(hover.cell.tokens, 'tokens')} tokens</div>
            <div className="muted">{hover.cell.sessionIds.length} session{hover.cell.sessionIds.length === 1 ? '' : 's'}</div>
          </div>
        )}
      </div>

      <div className="hm-legend">
        <span className="muted">low</span>
        {[0.1, 0.25, 0.5, 0.75, 1].map((v) => (
          <span key={v} className="hm-legend-cell" style={{ background: `color-mix(in srgb, var(--accent) ${v * 100}%, var(--bg-2))` }} />
        ))}
        <span className="muted">high · max {fmtVal(max, metric)}</span>
      </div>
    </div>
  );
}
