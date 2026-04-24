import { useEffect } from 'react';
import { useWorkspace } from '../store/workspace';

// Custom events fan out to components that own local UI state (split panes,
// queue input focus, list/cards toggle), keeping the keyboard layer global
// without forcing every piece of state into the store.
export type FrameEvent =
  | 'frame:split-right'
  | 'frame:split-down'
  | 'frame:split-close'
  | 'frame:queue-focus'
  | 'frame:tasks-toggle-view'
  | 'frame:quick-search';

export function dispatchFrameEvent(name: FrameEvent): void {
  window.dispatchEvent(new CustomEvent(name));
}

export function useFrameEvent(name: FrameEvent, handler: () => void): void {
  useEffect(() => {
    const fn = () => handler();
    window.addEventListener(name, fn);
    return () => window.removeEventListener(name, fn);
  }, [name, handler]);
}

const PANEL_KEYS: Record<string, 'dashboard' | 'tasks' | 'screenshots' | 'video' | 'locks'> = {
  '1': 'dashboard',
  '2': 'tasks',
  '3': 'screenshots',
  '4': 'video',
  '5': 'locks'
};

export function useHotkeys(): void {
  const sessions = useWorkspace((s) => s.sessions);
  const activeId = useWorkspace((s) => s.activeSessionId);
  const setActive = useWorkspace((s) => s.setActiveSession);
  const setPanel = useWorkspace((s) => s.setPanel);
  const create = useWorkspace((s) => s.createSession);
  const kill = useWorkspace((s) => s.killSession);
  const paths = useWorkspace((s) => s.paths);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip when user is typing in an input / textarea / contenteditable
      // (queue input, budget number, etc) — except for global escape combos.
      const target = e.target as HTMLElement;
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();

      // Ctrl+Shift+digit → switch to N-th terminal tab
      if (e.shiftKey && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const ptys = sessions.filter((s) => s.kind === 'pty');
        if (ptys[idx]) { e.preventDefault(); setActive(ptys[idx].id); }
        return;
      }

      // Ctrl+digit → switch right-panel tab
      if (!e.shiftKey && PANEL_KEYS[e.key]) {
        e.preventDefault();
        setPanel(PANEL_KEYS[e.key]);
        return;
      }

      // Ctrl+Shift+D → split right
      if (e.shiftKey && k === 'd') { e.preventDefault(); dispatchFrameEvent('frame:split-right'); return; }
      // Ctrl+Shift+E → split down
      if (e.shiftKey && k === 'e') { e.preventDefault(); dispatchFrameEvent('frame:split-down'); return; }
      // Ctrl+Shift+W → close split
      if (e.shiftKey && k === 'w') { e.preventDefault(); dispatchFrameEvent('frame:split-close'); return; }
      // Ctrl+Shift+L → toggle Tasks view list/cards
      if (e.shiftKey && k === 'l') { e.preventDefault(); dispatchFrameEvent('frame:tasks-toggle-view'); return; }

      // Ctrl+P → open quick search (works even when typing — VS Code convention)
      if (k === 'p' && !e.shiftKey) { e.preventDefault(); dispatchFrameEvent('frame:quick-search'); return; }

      if (inField) return; // remaining shortcuts shouldn't fire while typing

      // Ctrl+T → new shell in default cwd
      if (k === 't' && !e.shiftKey) {
        e.preventDefault();
        if (!paths) return;
        const cwd = paths.root.replace(/\\frame$/, '');
        const label = `session-${sessions.filter((s) => s.kind === 'pty').length + 1}`;
        void create({ cwd, label, cols: 120, rows: 32 });
        return;
      }
      // Ctrl+W → kill active session
      if (k === 'w' && !e.shiftKey) {
        e.preventDefault();
        if (activeId) void kill(activeId);
        return;
      }
      // Ctrl+Q → open Tasks + focus queue input
      if (k === 'q' && !e.shiftKey) {
        e.preventDefault();
        setPanel('tasks');
        setTimeout(() => dispatchFrameEvent('frame:queue-focus'), 50);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessions, activeId, setActive, setPanel, create, kill, paths]);
}
