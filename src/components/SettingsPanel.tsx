import { useEffect, useState } from 'react';
import { useNotifications } from '../store/notifications';
import { useWorkspace } from '../store/workspace';

const KEY_BUDGET = 'frame.cost.monthlyBudgetUSD';
const KEY_NOTIF_MUTE = 'frame.notifications.mute';

const VERSION = '0.2.7';
const REPO = 'https://github.com/AdotEXE/frame';
const APPDATA_PATH = 'C:\\Users\\PC\\AppData\\Roaming\\Frame\\frame';
const HOOK_BRIDGE = `${APPDATA_PATH}\\frame-hook.cjs`;
const MCP_BRIDGE = 'C:\\Users\\PC\\Desktop\\frame\\scripts\\mcp-bridge.cjs';

export function SettingsPanel() {
  const paths = useWorkspace((s) => s.paths);
  const push = useNotifications((s) => s.push);
  const [budget, setBudget] = useState<number>(() => parseFloat(localStorage.getItem(KEY_BUDGET) ?? '200') || 200);
  const [mute, setMute] = useState<boolean>(() => localStorage.getItem(KEY_NOTIF_MUTE) === '1');

  useEffect(() => { localStorage.setItem(KEY_BUDGET, String(budget)); }, [budget]);
  useEffect(() => { localStorage.setItem(KEY_NOTIF_MUTE, mute ? '1' : '0'); }, [mute]);

  function copyToClipboard(text: string, what: string) {
    void navigator.clipboard.writeText(text);
    push({ kind: 'success', title: `copied: ${what}` });
  }

  function openInBrowser(url: string) {
    window.open(url, '_blank');
  }

  function testNotif(kind: 'info' | 'success' | 'warning' | 'error') {
    push({ kind, title: `test ${kind} notification`, body: 'looks good?' });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">SETTINGS</span>
        <span className="panel-meta">v{VERSION}</span>
      </div>

      <div className="settings-section">
        <div className="settings-h">COST</div>
        <label className="settings-row">
          <span>Monthly budget (USD)</span>
          <input
            type="number"
            min={1}
            step={10}
            value={budget}
            onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v) && v > 0) setBudget(v); }}
          />
        </label>
        <div className="settings-hint">Used by Cost Meter projection bar in Dashboard. Default: $200 (Anthropic Max plan baseline).</div>
      </div>

      <div className="settings-section">
        <div className="settings-h">NOTIFICATIONS</div>
        <label className="settings-row">
          <span>Mute toast notifications</span>
          <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} />
        </label>
        <div className="settings-test">
          <button className="btn subtle small" onClick={() => testNotif('info')}>info</button>
          <button className="btn subtle small" onClick={() => testNotif('success')}>success</button>
          <button className="btn subtle small" onClick={() => testNotif('warning')}>warning</button>
          <button className="btn subtle small" onClick={() => testNotif('error')}>error</button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-h">HOOKS BRIDGE</div>
        <div className="settings-row mono"><span>script</span><code>{HOOK_BRIDGE}</code></div>
        <div className="settings-hint">
          Drop these into <code>~/.claude/settings.json</code> hooks block (PreToolUse / PostToolUse / SessionStart / SessionEnd). See HOOKS_SETUP.md.
        </div>
        <button className="btn subtle small" onClick={() => copyToClipboard(`node "${HOOK_BRIDGE}"`, 'hook command')}>copy hook command</button>
      </div>

      <div className="settings-section">
        <div className="settings-h">MCP SERVER</div>
        <div className="settings-row mono"><span>HTTP API</span><code>http://127.0.0.1:47822</code></div>
        <div className="settings-row mono"><span>bridge</span><code>{MCP_BRIDGE}</code></div>
        <div className="settings-hint">
          Add to <code>~/.claude/settings.json</code> mcpServers. See MCP_SETUP.md.
        </div>
        <button className="btn subtle small" onClick={() => copyToClipboard(JSON.stringify({ command: 'node', args: [MCP_BRIDGE] }, null, 2), 'MCP config')}>copy MCP config</button>
      </div>

      <div className="settings-section">
        <div className="settings-h">DATA</div>
        {paths && (
          <>
            <div className="settings-row mono"><span>root</span><code>{paths.root}</code></div>
            <div className="settings-row mono"><span>screenshots</span><code>{paths.screenshots}</code></div>
            <div className="settings-row mono"><span>videos</span><code>{paths.videos}</code></div>
            <div className="settings-row mono"><span>data (sqlite/jsonl)</span><code>{paths.data}</code></div>
          </>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-h">ABOUT</div>
        <div className="settings-row"><span>Version</span><code>{VERSION}</code></div>
        <div className="settings-row"><span>Repo</span><a className="settings-link" onClick={() => openInBrowser(REPO)}>{REPO}</a></div>
        <div className="settings-row"><span>Stack</span><span>Electron 33 · Vite 5 · React 18 · TS 5</span></div>
      </div>
    </div>
  );
}
