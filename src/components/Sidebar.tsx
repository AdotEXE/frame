import { useWorkspace } from '../store/workspace';

const PANELS: Array<{ key: 'dashboard' | 'screenshots' | 'video' | 'locks' | 'tasks' | 'settings'; icon: string; label: string }> = [
  { key: 'dashboard', icon: '▤', label: 'Agents' },
  { key: 'tasks', icon: '▦', label: 'Tasks' },
  { key: 'screenshots', icon: '◰', label: 'Snaps' },
  { key: 'video', icon: '▶', label: 'Video' },
  { key: 'locks', icon: '⛬', label: 'Locks' },
  { key: 'settings', icon: '⚙', label: 'Settings' }
];

export function Sidebar() {
  const panel = useWorkspace((s) => s.panel);
  const setPanel = useWorkspace((s) => s.setPanel);

  return (
    <nav className="side-nav">
      {PANELS.map((p) => (
        <button
          key={p.key}
          className={`side-btn ${panel === p.key ? 'active' : ''}`}
          onClick={() => setPanel(p.key)}
          title={p.label}
        >
          <span className="side-icon">{p.icon}</span>
          <span className="side-label">{p.label}</span>
        </button>
      ))}
    </nav>
  );
}
