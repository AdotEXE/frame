import { useNotifications } from '../store/notifications';

const ICON: Record<string, string> = {
  info: '◆',
  success: '✓',
  warning: '!',
  error: '×'
};

export function Notifications() {
  const items = useNotifications((s) => s.items);
  const dismiss = useNotifications((s) => s.dismiss);

  if (items.length === 0) return null;
  return (
    <div className="notif-stack">
      {items.map((n) => (
        <div key={n.id} className={`notif kind-${n.kind}`}>
          <span className={`notif-icon kind-${n.kind}`}>{ICON[n.kind]}</span>
          <div className="notif-body">
            <div className="notif-title">{n.title}</div>
            {n.body && <div className="notif-text">{n.body}</div>}
          </div>
          {n.action && (
            <button className="btn subtle small" onClick={() => { n.action!.run(); dismiss(n.id); }}>
              {n.action.label}
            </button>
          )}
          <button className="notif-x" onClick={() => dismiss(n.id)} title="dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
