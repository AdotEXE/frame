import { useEffect } from 'react';
import { useWorkspace } from '../store/workspace';
import type { TaskAgent, ToolEvent, SubagentInvocation } from '../types/frame';

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

  useEffect(() => { void refresh(); }, [refresh]);

  if (!tasks) return <div className="panel"><div className="muted">scanning task logs…</div></div>;

  const live = tasks.agents.filter((a) => a.inflightTool || (Date.now() - a.fileMtime) < 60_000);
  const idle = tasks.agents.filter((a) => !a.inflightTool && (Date.now() - a.fileMtime) >= 60_000);

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">TASKS</span>
        <span className="panel-meta">
          {live.length} active · {idle.length} idle · last {tasks.windowHours}h
        </span>
      </div>
      <div className="panel-actions">
        <button className="btn subtle small" onClick={() => refresh(1)}>1h</button>
        <button className="btn subtle small" onClick={() => refresh(6)}>6h</button>
        <button className="btn subtle small" onClick={() => refresh(24)}>24h</button>
        <button className="btn subtle small" onClick={() => refresh(24 * 7)}>7d</button>
      </div>

      {live.length > 0 && (
        <>
          <div className="panel-head sub"><span>ACTIVE</span><span className="panel-meta">{live.length}</span></div>
          {live.map((a) => <AgentCard key={a.sessionId} agent={a} />)}
        </>
      )}

      {idle.length > 0 && (
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
          <span className="task-tool-input" title={agent.inflightTool.inputPreview}>{agent.inflightTool.inputPreview}</span>
          <span className="task-tool-elapsed">{ago(agent.inflightTool.ts)}</span>
        </div>
      )}

      {agent.lastUserPrompt && !compact && (
        <div className="task-prompt">
          <span className="task-prompt-label">last prompt</span>
          <span className="task-prompt-text">{agent.lastUserPrompt}</span>
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

function ToolRow({ tool }: { tool: ToolEvent }) {
  return (
    <div className="task-tool-row">
      <span className="task-tool-time">{ago(tool.ts)}</span>
      <span className="task-tool-name-mini">{tool.name}</span>
      <span className="task-tool-input-mini" title={tool.inputPreview}>{tool.inputPreview}</span>
    </div>
  );
}
