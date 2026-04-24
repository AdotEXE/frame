import { useEffect, useState } from 'react';
import { useWorkspace } from '../store/workspace';

type MascotState = 'idle' | 'busy' | 'excited' | 'tired' | 'sleeping' | 'spark';

const FACES: Record<MascotState, string> = {
  idle:     '( •_• )',
  busy:     '( •̀ᴗ•́ )',
  excited:  '( ✧ヮ✧ )',
  tired:    '( ×_× )',
  sleeping: '( - . -)',
  spark:    '(⌐■_■)'
};

const LABELS: Record<MascotState, string> = {
  idle:     'idle',
  busy:     'working',
  excited:  'frenzy',
  tired:    'slow down',
  sleeping: 'zzz',
  spark:    'ready'
};

export function Mascot() {
  const sessions = useWorkspace((s) => s.sessions);
  const cost = useWorkspace((s) => s.cost);
  const tasks = useWorkspace((s) => s.tasks);
  const events = useWorkspace((s) => s.events);
  const queue = useWorkspace((s) => s.queue);
  const [, setTick] = useState(0);
  const [visible, setVisible] = useState<boolean>(() => localStorage.getItem('frame.mascot.visible') !== '0');
  const [recentSpawn, setRecentSpawn] = useState<number | null>(null);

  // Re-evaluate state every few seconds.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 3000);
    return () => clearInterval(t);
  }, []);

  // React to new sessions.
  useEffect(() => {
    if (sessions.length > 0) setRecentSpawn(Date.now());
  }, [sessions.length]);

  useEffect(() => {
    localStorage.setItem('frame.mascot.visible', visible ? '1' : '0');
  }, [visible]);

  if (!visible) {
    return <button className="mascot-hidden-chip" onClick={() => setVisible(true)} title="show mascot">◐</button>;
  }

  const busyAgents = tasks?.agents.filter((a) => a.inflightTool).length ?? 0;
  const lastEventAgo = events[0] ? Date.now() - events[0].ts : Infinity;
  const pendingQueue = queue.filter((t) => t.status === 'pending').length;

  const budget = parseFloat(localStorage.getItem('frame.cost.monthlyBudgetUSD') ?? '200') || 200;
  const monthlyProjection = cost && cost.windowHours > 0
    ? cost.totalUsdEstimate * (24 * 30 / cost.windowHours)
    : 0;

  let state: MascotState;
  if (recentSpawn && Date.now() - recentSpawn < 4000) state = 'spark';
  else if (lastEventAgo > 30 * 60 * 1000) state = 'sleeping';
  else if (busyAgents >= 3) state = 'excited';
  else if (monthlyProjection > budget * 3) state = 'tired';
  else if (busyAgents >= 1) state = 'busy';
  else state = 'idle';

  const tooltip = [
    `state: ${LABELS[state]}`,
    `${sessions.filter((s) => s.kind === 'pty').length} local · ${sessions.filter((s) => s.kind === 'ghost').length} ext`,
    `${busyAgents} running`,
    `${pendingQueue} queued`,
    cost ? `$${cost.totalUsdEstimate.toFixed(0)} last ${cost.windowHours}h` : ''
  ].filter(Boolean).join('\n');

  return (
    <div className={`mascot state-${state}`} title={tooltip}>
      <button
        className="mascot-hide"
        onClick={() => setVisible(false)}
        title="hide mascot (chip stays in corner)"
      >×</button>
      <div className="mascot-face">{FACES[state]}</div>
      <div className="mascot-label">{LABELS[state]}</div>
    </div>
  );
}
