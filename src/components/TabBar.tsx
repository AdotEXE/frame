import { useWorkspace } from '../store/workspace';

export function TabBar() {
  const sessions = useWorkspace((s) => s.sessions);
  const activeId = useWorkspace((s) => s.activeSessionId);
  const setActive = useWorkspace((s) => s.setActiveSession);
  const create = useWorkspace((s) => s.createSession);
  const kill = useWorkspace((s) => s.killSession);
  const paths = useWorkspace((s) => s.paths);

  async function handleAdd() {
    const cwd = await window.frame.app.openFolder();
    if (!cwd) return;
    const label = `session-${sessions.length + 1}`;
    await create({ cwd, label, cols: 120, rows: 32 });
  }

  async function handleAddHere() {
    if (!paths) return;
    const cwd = paths.root.replace(/\\frame$/, '');
    const label = `session-${sessions.length + 1}`;
    await create({ cwd, label, cols: 120, rows: 32 });
  }

  return (
    <div className="tab-bar">
      {sessions.map((s) => (
        <div key={s.id} className={`tab ${s.id === activeId ? 'active' : ''} status-${s.status}`}>
          <button className="tab-main" onClick={() => setActive(s.id)} title={s.cwd}>
            <span className="tab-status-dot" />
            <span className="tab-label">{s.label}</span>
            {s.lastTool && <span className="tab-tool">{s.lastTool}</span>}
          </button>
          <button className="tab-close" onClick={() => kill(s.id)} title="kill session">×</button>
        </div>
      ))}
      <button className="tab-add" onClick={handleAdd} title="new session in folder…">+ folder</button>
      <button className="tab-add subtle" onClick={handleAddHere} title="new session in default cwd">+ quick</button>
    </div>
  );
}
