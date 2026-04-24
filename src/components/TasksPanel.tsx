import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../store/workspace';
import type { TaskAgent, ToolEvent, SubagentInvocation, InternalTask } from '../types/frame';
import { TypewriterText } from '../lib/typewriter';
import { useFrameEvent } from '../lib/hotkeys';

type ViewMode = 'cards' | 'list';
const VIEW_KEY = 'frame.tasks.view';

function ago(ts: number | null): string {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function projectShort(cwd: string): string {
  if (!cwd) return 'unknown';
  return cwd.split(/[\\/]/).filter(Boolean).slice(-2).join('/');
}

export function TasksPanel() {
  const tasks = useWorkspace((s) => s.tasks);
  const refresh = useWorkspace((s) => s.refreshTasks);
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'cards');
  const [tick, setTick] = useState(0);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);
  // Force re-render every second so "ago" timers stay live between fetches.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useFrameEvent('frame:tasks-toggle-view', () => setView((v) => v === 'cards' ? 'list' : 'cards'));

  if (!tasks) return <div className="panel"><div className="muted">scanning task logs…</div></div>;

  const live = tasks.agents.filter((a) => a.inflightTool || (Date.now() - a.fileMtime) < 60_000);
  const idle = tasks.agents.filter((a) => !a.inflightTool && (Date.now() - a.fileMtime) >= 60_000);
  const lastScanAgo = ago(tasks.scannedAt);
  void tick;

  return (
    <div className="panel">
      <Queue />

      <div className="panel-head">
        <span className="panel-title">CLAUDE AGENTS</span>
        <span className="panel-meta">
          {live.length} active · {idle.length} idle · scanned {lastScanAgo} ago · last {tasks.windowHours}h
        </span>
      </div>
      <div className="panel-actions">
        <button className="btn subtle small" onClick={() => refresh(1)}>1h</button>
        <button className="btn subtle small" onClick={() => refresh(6)}>6h</button>
        <button className="btn subtle small" onClick={() => refresh(24)}>24h</button>
        <button className="btn subtle small" onClick={() => refresh(24 * 7)}>7d</button>
        <span style={{ flex: 1 }} />
        <button className={`btn subtle small ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}>cards</button>
        <button className={`btn subtle small ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>list</button>
      </div>

      {view === 'list' && tasks.agents.length > 0 && (
        <div className="task-list">
          {tasks.agents.map((a) => <AgentRow key={a.sessionId} agent={a} />)}
        </div>
      )}

      {view === 'cards' && live.length > 0 && (
        <>
          <div className="panel-head sub"><span>ACTIVE</span><span className="panel-meta">{live.length}</span></div>
          {live.map((a) => <AgentCard key={a.sessionId} agent={a} />)}
        </>
      )}

      {view === 'cards' && idle.length > 0 && (
        <>
          <div className="panel-head sub"><span>IDLE</span><span className="panel-meta">{idle.length}</span></div>
          {idle.map((a) => <AgentCard key={a.sessionId} agent={a} compact />)}
        </>
      )}

      {tasks.agents.length === 0 && (
        <div className="muted">no Claude sessions in window — open a Claude Code session somewhere</div>
      )}
    </div>
  );
}

function AgentCard({ agent, compact }: { agent: TaskAgent; compact?: boolean }) {
  const isLive = !!agent.inflightTool;
  return (
    <div className={`task-card ${isLive ? 'live' : 'idle'}`}>
      <div className="task-card-head">
        <span className={`task-dot ${isLive ? 'on' : ''}`} />
        <span className="task-project" title={agent.cwd}>{projectShort(agent.cwd)}</span>
        <span className="task-id">{agent.sessionId.slice(0, 8)}</span>
        <span className="task-mtime">{ago(agent.fileMtime)}</span>
      </div>

      {agent.inflightTool && (
        <div className="task-inflight">
          <span className="task-inflight-tag">RUNNING</span>
          <span className="task-tool-name">{agent.inflightTool.name}</span>
          <TypewriterText
            key={agent.inflightTool.id}
            className="task-tool-input"
            text={agent.inflightTool.inputPreview}
            speedMs={10}
            cursor={false}
          />
          <span className="task-tool-elapsed">{ago(agent.inflightTool.ts)}</span>
        </div>
      )}

      {agent.lastUserPrompt && !compact && (
        <div className="task-prompt">
          <span className="task-prompt-label">last prompt</span>
          <TypewriterText
            key={`${agent.sessionId}:${agent.lastUserPromptAt ?? 0}`}
            className="task-prompt-text"
            text={agent.lastUserPrompt}
            speedMs={12}
          />
        </div>
      )}

      {agent.subagents.length > 0 && (
        <div className="task-subagents">
          <div className="task-subhead">subagents · {agent.subagents.length}</div>
          {agent.subagents.slice(-5).reverse().map((s) => <SubagentRow key={s.id} sub={s} />)}
        </div>
      )}

      {!compact && agent.recentTools.length > 0 && (
        <div className="task-recent">
          <div className="task-subhead">recent · {agent.totalTurns} turns total</div>
          {agent.recentTools.map((t) => <ToolRow key={t.id} tool={t} />)}
        </div>
      )}
    </div>
  );
}

function SubagentRow({ sub }: { sub: SubagentInvocation }) {
  return (
    <div className={`task-subagent status-${sub.status}`}>
      <span className="task-sub-status">{sub.status === 'inflight' ? '◉' : '◌'}</span>
      <span className="task-sub-type">{sub.type}</span>
      <span className="task-sub-desc" title={sub.promptPreview}>{sub.description || sub.promptPreview}</span>
      <span className="task-sub-time">{ago(sub.startedAt)}</span>
    </div>
  );
}

function Queue() {
  const queue = useWorkspace((s) => s.queue);
  const refresh = useWorkspace((s) => s.refreshQueue);
  const add = useWorkspace((s) => s.queueAdd);
  const update = useWorkspace((s) => s.queueUpdate);
  const remove = useWorkspace((s) => s.queueRemove);
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void refresh(); }, [refresh]);
  useFrameEvent('frame:queue-focus', () => inputRef.current?.focus());

  const visible = showDone ? queue : queue.filter((t) => t.status !== 'done');
  const pending = queue.filter((t) => t.status === 'pending').length;
  const inProgress = queue.filter((t) => t.status === 'in-progress').length;
  const done = queue.filter((t) => t.status === 'done').length;

  async function submit() {
    const v = draft.trim();
    if (!v) return;
    setDraft('');
    await add(v);
  }

  async function cycleStatus(t: InternalTask) {
    const next = t.status === 'pending' ? 'in-progress' : t.status === 'in-progress' ? 'done' : 'pending';
    await update(t.id, { status: next });
  }

  return (
    <>
      <div className="panel-head">
        <span className="panel-title">MY QUEUE</span>
        <span className="panel-meta">
          {pending} pending · {inProgress} in-progress · {done} done
        </span>
      </div>

      <div className="queue-input">
        <input
          ref={inputRef}
          className="queue-input-field"
          placeholder="add task to queue (Enter) · Ctrl+Q from anywhere"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        />
        <button className="btn" onClick={() => void submit()} disabled={!draft.trim()}>+ add</button>
      </div>

      <div className="queue-list">
        {visible.length === 0 && <div className="muted">queue is empty — add your first task above</div>}
        {visible.map((t) => (
          <div key={t.id} className={`queue-row status-${t.status}`}>
            <button
              className={`queue-check status-${t.status}`}
              onClick={() => void cycleStatus(t)}
              title={`cycle: pending → in-progress → done · current: ${t.status}`}
            >
              {t.status === 'done' ? '✓' : t.status === 'in-progress' ? '◐' : '○'}
            </button>
            <span className="queue-title">{t.title}</span>
            <button className="queue-del" onClick={() => void remove(t.id)} title="delete">×</button>
          </div>
        ))}
      </div>

      <div className="queue-footer">
        <button className="btn subtle small" onClick={() => setShowDone((v) => !v)}>
          {showDone ? 'hide done' : `show done (${done})`}
        </button>
      </div>
    </>
  );
}

function AgentRow({ agent }: { agent: TaskAgent }) {
  const isLive = !!agent.inflightTool;
  const title = agent.lastUserPrompt ?? '(no user prompt)';
  return (
    <div className={`task-row ${isLive ? 'live' : 'idle'}`} title={`${agent.cwd}\n\n${title}`}>
      <span className={`task-dot ${isLive ? 'on' : ''}`} />
      <span className="task-row-project">{projectShort(agent.cwd)}</span>
      {agent.lastUserPrompt
        ? <TypewriterText
            key={`${agent.sessionId}:${agent.lastUserPromptAt ?? 0}`}
            className="task-row-title"
            text={agent.lastUserPrompt}
            speedMs={8}
            cursor={false}
          />
        : <span className="task-row-title muted">— no prompt yet —</span>
      }
      {agent.inflightTool && <span className="task-row-tool">{agent.inflightTool.name}</span>}
      <span className="task-row-time">{ago(agent.fileMtime)}</span>
    </div>
  );
}

function ToolRow({ tool }: { tool: ToolEvent }) {
  return (
    <div className="task-tool-row">
      <span className="task-tool-time">{ago(tool.ts)}</span>
      <span className="task-tool-name-mini">{tool.name}</span>
      <span className="task-tool-input-mini" title={tool.inputPreview}>{tool.inputPreview}</span>
    </div>
  );
}
