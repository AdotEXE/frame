import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { Terminal } from './Terminal';
import { Dashboard } from './Dashboard';
import { ScreenshotGallery } from './ScreenshotGallery';
import { VideoPanel } from './VideoPanel';
import { LocksPanel } from './LocksPanel';
import { useWorkspace } from '../store/workspace';

export function Workspace() {
  const sessions = useWorkspace((s) => s.sessions);
  const activeId = useWorkspace((s) => s.activeSessionId);
  const panel = useWorkspace((s) => s.panel);
  const paths = useWorkspace((s) => s.paths);
  const createSession = useWorkspace((s) => s.createSession);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!paths || bootstrapped) return;
    setBootstrapped(true);
    void createSession({
      cwd: paths.root.replace(/\\frame$/, ''),
      label: 'frame-1',
      cols: 120,
      rows: 32
    });
  }, [paths, bootstrapped, createSession]);

  return (
    <div className="frame-shell">
      <header className="frame-header">
        <div className="brand">
          <span className="brand-glyph">▍</span>
          <span className="brand-name">FRAME</span>
          <span className="brand-tag">v0.2.1 — multi-session command bridge</span>
        </div>
        <div className="header-actions">
          <span className="status-dot ok" />
          <span className="status-text">
            {sessions.filter((s) => s.kind === 'pty').length} local · {sessions.filter((s) => s.kind === 'ghost').length} external
          </span>
        </div>
      </header>

      <div className="frame-body">
        <aside className="frame-sidebar">
          <Sidebar />
        </aside>

        <main className="frame-main">
          <TabBar />
          <div className="terminal-stage">
            {sessions.filter((s) => s.kind === 'pty').length === 0 && (
              <div className="empty-stage">
                <div className="empty-glyph">◇</div>
                <div className="empty-title">no sessions yet</div>
                <div className="empty-hint">spawn your first via the + tab</div>
              </div>
            )}
            {sessions.filter((s) => s.kind === 'pty').map((s) => (
              <div key={s.id} className={`terminal-host ${s.id === activeId ? 'active' : 'hidden'}`}>
                <Terminal sessionId={s.id} />
              </div>
            ))}
          </div>
        </main>

        <aside className="frame-rightpanel">
          {panel === 'dashboard' && <Dashboard />}
          {panel === 'screenshots' && <ScreenshotGallery />}
          {panel === 'video' && <VideoPanel />}
          {panel === 'locks' && <LocksPanel />}
        </aside>
      </div>
    </div>
  );
}
