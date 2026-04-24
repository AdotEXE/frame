import { useWorkspace } from '../store/workspace';
import { TAB_DRAG_TYPE } from './TerminalStage';

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

  function onDragStart(e: React.DragEvent, sessionId: string) {
    e.dataTransfer.setData(TAB_DRAG_TYPE, sessionId);
    e.dataTransfer.effectAllowed = 'move';
  }

  const ptySessions = sessions.filter((s) => s.kind === 'pty');

  return (
    <div className="tab-bar">
      {ptySessions.map((s) => (
        <div
          key={s.id}
          draggable
          onDragStart={(e) => onDragStart(e, s.id)}
          className={`tab ${s.id === activeId ? 'active' : ''} status-${s.status}`}
          title={`${s.cwd}\n\ndrag → drop into terminal area to split`}
        >
          <button className="tab-main" onClick={() => setActive(s.id)}>
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
