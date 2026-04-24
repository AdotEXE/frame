import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { TerminalStage } from './TerminalStage';
import { Dashboard } from './Dashboard';
import { ScreenshotGallery } from './ScreenshotGallery';
import { VideoPanel } from './VideoPanel';
import { LocksPanel } from './LocksPanel';
import { TasksPanel } from './TasksPanel';
import { SettingsPanel } from './SettingsPanel';
import { ActivityHeatmap } from './ActivityHeatmap';
import { StatusBar } from './StatusBar';
import { QuickSearch } from './QuickSearch';
import { Notifications } from './Notifications';
import { useHotkeys } from '../lib/hotkeys';
import { useWorkspace } from '../store/workspace';

export function Workspace() {
  const sessions = useWorkspace((s) => s.sessions);
  const panel = useWorkspace((s) => s.panel);
  const paths = useWorkspace((s) => s.paths);
  const createSession = useWorkspace((s) => s.createSession);
  const setPanel = useWorkspace((s) => s.setPanel);
  const [bootstrapped, setBootstrapped] = useState(false);
  useHotkeys();

  useEffect(() => {
    const off = window.frame.app.onSetPanel((name) => {
      const valid: Array<'dashboard' | 'tasks' | 'heatmap' | 'screenshots' | 'video' | 'locks' | 'settings'> = ['dashboard', 'tasks', 'heatmap', 'screenshots', 'video', 'locks', 'settings'];
      if (valid.includes(name as typeof valid[number])) setPanel(name as typeof valid[number]);
    });
    return () => off();
  }, [setPanel]);

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
          <span className="brand-tag">v0.2.2 — multi-session command bridge</span>
        </div>
        <div className="header-actions">
          <span className="status-dot ok" />
          <span className="status-text">
            {sessions.filter((s) => s.kind === 'pty').length} local · {sessions.filter((s) => s.kind === 'ghost').length} external
          </span>
        </div>
      </header>

      <div className="frame-body">
        <PanelGroup direction="horizontal" autoSaveId="frame-outer">
          <Panel defaultSize={5} minSize={3} maxSize={20} className="frame-sidebar-panel">
            <aside className="frame-sidebar">
              <Sidebar />
            </aside>
          </Panel>
          <PanelResizeHandle className="ph ph-h" />
          <Panel defaultSize={70} minSize={30}>
            <main className="frame-main">
              <TabBar />
              <TerminalStage />
            </main>
          </Panel>
          <PanelResizeHandle className="ph ph-h" />
          <Panel defaultSize={25} minSize={15} maxSize={60}>
            <aside className="frame-rightpanel">
              {panel === 'dashboard' && <Dashboard />}
              {panel === 'tasks' && <TasksPanel />}
              {panel === 'screenshots' && <ScreenshotGallery />}
              {panel === 'video' && <VideoPanel />}
              {panel === 'locks' && <LocksPanel />}
              {panel === 'settings' && <SettingsPanel />}
              {panel === 'heatmap' && <ActivityHeatmap />}
            </aside>
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar />
      <QuickSearch />
      <Notifications />
    </div>
  );
}
