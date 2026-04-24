import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../store/workspace';
import { useFrameEvent, dispatchFrameEvent } from '../lib/hotkeys';
import { VoiceInput } from './VoiceInput';

type ResultKind = 'session' | 'queue' | 'screenshot' | 'video' | 'event' | 'task';

interface Result {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  action: () => void;
}

export function QuickSearch() {
  const sessions = useWorkspace((s) => s.sessions);
  const queue = useWorkspace((s) => s.queue);
  const screenshots = useWorkspace((s) => s.screenshots);
  const videoJobs = useWorkspace((s) => s.videoJobs);
  const events = useWorkspace((s) => s.events);
  const tasks = useWorkspace((s) => s.tasks);
  const setActive = useWorkspace((s) => s.setActiveSession);
  const setPanel = useWorkspace((s) => s.setPanel);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hoverIdx, setHoverIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useFrameEvent('frame:quick-search', () => {
    setOpen(true);
    setQ('');
    setHoverIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  });

  const results: Result[] = useMemo(() => {
    if (!open) return [];
    const needle = q.trim().toLowerCase();
    const out: Result[] = [];

    for (const s of sessions) {
      const hay = `${s.label} ${s.cwd} ${s.lastTool ?? ''} ${s.lastFile ?? ''}`.toLowerCase();
      if (!needle || hay.includes(needle)) {
        out.push({
          id: `s-${s.id}`,
          kind: 'session',
          title: s.label,
          subtitle: `${s.kind === 'pty' ? 'pty' : 'ext'} · ${s.cwd}`,
          action: () => { if (s.kind === 'pty') setActive(s.id); }
        });
      }
    }

    for (const t of queue) {
      const hay = `${t.title} ${t.notes ?? ''}`.toLowerCase();
      if (!needle || hay.includes(needle)) {
        out.push({
          id: `q-${t.id}`,
          kind: 'queue',
          title: t.title,
          subtitle: `queue · ${t.status}`,
          action: () => setPanel('tasks')
        });
      }
    }

    for (const sh of screenshots.slice(0, 200)) {
      const hay = `${sh.label ?? ''} ${sh.source} ${sh.width}x${sh.height}`.toLowerCase();
      if (!needle || hay.includes(needle)) {
        out.push({
          id: `sh-${sh.id}`,
          kind: 'screenshot',
          title: sh.label ?? `${sh.width}×${sh.height} (${sh.source})`,
          subtitle: `screenshot · ${new Date(sh.createdAt).toLocaleString()}`,
          action: () => setPanel('screenshots')
        });
      }
    }

    for (const v of videoJobs) {
      const name = v.source.split(/[\\/]/).pop() ?? v.source;
      const hay = `${name} ${v.source}`.toLowerCase();
      if (!needle || hay.includes(needle)) {
        out.push({
          id: `v-${v.id}`,
          kind: 'video',
          title: name,
          subtitle: `video · ${v.totalFrames} frames · ${v.passCount} passes`,
          action: () => setPanel('video')
        });
      }
    }

    if (tasks) {
      for (const a of tasks.agents.slice(0, 50)) {
        const hay = `${a.lastUserPrompt ?? ''} ${a.cwd} ${a.inflightTool?.name ?? ''}`.toLowerCase();
        if (needle && hay.includes(needle)) {
          out.push({
            id: `t-${a.sessionId}`,
            kind: 'task',
            title: a.lastUserPrompt ?? '(no prompt)',
            subtitle: `task · ${a.cwd.split(/[\\/]/).slice(-2).join('/')}`,
            action: () => setPanel('tasks')
          });
        }
      }
    }

    if (needle) {
      for (const e of events.slice(0, 100)) {
        const hay = `${e.tool ?? ''} ${e.filePath ?? ''} ${e.hook ?? ''}`.toLowerCase();
        if (hay.includes(needle)) {
          out.push({
            id: `e-${e.ts}-${out.length}`,
            kind: 'event',
            title: `${e.hook} ${e.tool ?? ''}`.trim(),
            subtitle: `event · ${e.filePath ?? ''}`,
            action: () => setPanel('dashboard')
          });
        }
      }
    }

    return out.slice(0, 50);
  }, [open, q, sessions, queue, screenshots, videoJobs, tasks, events, setActive, setPanel]);

  useEffect(() => { setHoverIdx(0); }, [q]);

  function close() { setOpen(false); setQ(''); }

  function activate(idx: number) {
    const r = results[idx];
    if (!r) return;
    r.action();
    close();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHoverIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHoverIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); activate(hoverIdx); }
  }

  if (!open) return null;

  return (
    <div className="qs-overlay" onClick={close}>
      <div className="qs-box" onClick={(e) => e.stopPropagation()}>
        <div className="qs-input-wrap">
          <input
            ref={inputRef}
            className="qs-input"
            placeholder="search sessions, queue, snaps, videos, events… · 🎤 hold to speak"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <VoiceInput onInterim={(t) => setQ(t)} onResult={(t) => setQ(t)} />
        </div>
        <div className="qs-results">
          {results.length === 0 && (
            <div className="qs-empty">{q ? 'no matches' : 'start typing — or ↑↓ to scroll all'}</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              className={`qs-row ${i === hoverIdx ? 'hover' : ''} kind-${r.kind}`}
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => activate(i)}
            >
              <span className={`qs-kind kind-${r.kind}`}>{r.kind}</span>
              <span className="qs-title">{r.title}</span>
              {r.subtitle && <span className="qs-sub">{r.subtitle}</span>}
            </button>
          ))}
        </div>
        <div className="qs-footer">
          <span><kbd>↑↓</kbd> nav</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

export function _ensureUseImport() { void dispatchFrameEvent; }
