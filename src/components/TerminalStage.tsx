import { useState, useRef, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useWorkspace } from '../store/workspace';
import { Terminal } from './Terminal';
import type { SessionInfo } from '../types/frame';

type SplitMode = 'single' | 'h' | 'v';
type DropZone = 'right' | 'bottom' | null;

const DRAG_TYPE = 'application/x-frame-tab';

export function TerminalStage() {
  const sessions = useWorkspace((s) => s.sessions);
  const activeId = useWorkspace((s) => s.activeSessionId);
  const setActiveSession = useWorkspace((s) => s.setActiveSession);

  const ptySessions = sessions.filter((s) => s.kind === 'pty');
  const [splitMode, setSplitMode] = useState<SplitMode>('single');
  const [paneBId, setPaneBId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<DropZone>(null);
  const [dragActive, setDragActive] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Listen for any drag involving our tab payload so the overlay only appears when relevant.
  useEffect(() => {
    const onStart = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(DRAG_TYPE)) setDragActive(true);
    };
    const onEnd = () => { setDragActive(false); setDragOver(null); };
    window.addEventListener('dragstart', onStart);
    window.addEventListener('dragend', onEnd);
    window.addEventListener('drop', onEnd);
    return () => {
      window.removeEventListener('dragstart', onStart);
      window.removeEventListener('dragend', onEnd);
      window.removeEventListener('drop', onEnd);
    };
  }, []);

  // Keep paneBId valid (session might have been killed).
  useEffect(() => {
    if (paneBId && !ptySessions.some((s) => s.id === paneBId)) {
      setPaneBId(null);
      if (splitMode !== 'single') setSplitMode('single');
    }
  }, [ptySessions, paneBId, splitMode]);

  function handleDrop(zone: 'right' | 'bottom', e: React.DragEvent) {
    e.preventDefault();
    const sid = e.dataTransfer.getData(DRAG_TYPE);
    if (!sid) return;
    if (sid === activeId && ptySessions.length === 1) return; // nothing to split into
    setPaneBId(sid);
    setSplitMode(zone === 'right' ? 'h' : 'v');
    setDragOver(null);
    setDragActive(false);
  }

  function killSplit() {
    setSplitMode('single');
    setPaneBId(null);
  }

  if (ptySessions.length === 0) {
    return (
      <div className="terminal-stage">
        <div className="empty-stage">
          <div className="empty-glyph">◇</div>
          <div className="empty-title">no sessions yet</div>
          <div className="empty-hint">spawn your first via the + tab</div>
        </div>
      </div>
    );
  }

  const renderPane = (paneSessionId: string | null, isPaneB: boolean) => {
    const targetId = paneSessionId ?? activeId;
    return (
      <div className="terminal-pane">
        {isPaneB && (
          <div className="pane-header">
            <PaneSwitcher
              sessions={ptySessions}
              currentId={targetId}
              onPick={(id) => setPaneBId(id)}
            />
            <button className="pane-close" onClick={killSplit} title="close split">×</button>
          </div>
        )}
        <div className="pane-terminals">
          {ptySessions.map((s) => (
            <div
              key={s.id}
              className={`terminal-host ${s.id === targetId ? 'active' : 'hidden'}`}
              onClick={() => { if (!isPaneB) setActiveSession(s.id); }}
            >
              <Terminal sessionId={s.id} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="terminal-stage" ref={stageRef}>
      {splitMode === 'single' && renderPane(null, false)}

      {splitMode !== 'single' && (
        <PanelGroup direction={splitMode === 'h' ? 'horizontal' : 'vertical'} autoSaveId={`frame-stage-${splitMode}`}>
          <Panel defaultSize={50} minSize={20}>{renderPane(null, false)}</Panel>
          <PanelResizeHandle className={`ph ${splitMode === 'h' ? 'ph-h' : 'ph-v'}`} />
          <Panel defaultSize={50} minSize={20}>{renderPane(paneBId, true)}</Panel>
        </PanelGroup>
      )}

      {dragActive && (
        <div className="drop-overlay">
          <div
            className={`drop-overlay-zone right ${dragOver === 'right' ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver('right'); }}
            onDragLeave={() => setDragOver((z) => (z === 'right' ? null : z))}
            onDrop={(e) => handleDrop('right', e)}
          >
            <span className="drop-zone-label">split right</span>
          </div>
          <div
            className={`drop-overlay-zone bottom ${dragOver === 'bottom' ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver('bottom'); }}
            onDragLeave={() => setDragOver((z) => (z === 'bottom' ? null : z))}
            onDrop={(e) => handleDrop('bottom', e)}
          >
            <span className="drop-zone-label">split bottom</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PaneSwitcher({ sessions, currentId, onPick }: { sessions: SessionInfo[]; currentId: string | null; onPick(id: string): void }) {
  return (
    <div className="pane-switcher">
      {sessions.map((s) => (
        <button
          key={s.id}
          className={`pane-pick ${s.id === currentId ? 'active' : ''}`}
          onClick={() => onPick(s.id)}
          title={s.cwd}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export const TAB_DRAG_TYPE = DRAG_TYPE;
