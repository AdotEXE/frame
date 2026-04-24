import { create } from 'zustand';

export type NotifKind = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  kind: NotifKind;
  title: string;
  body?: string;
  createdAt: number;
  ttlMs: number; // 0 = persistent
  action?: { label: string; run(): void };
}

interface PushOpts {
  kind: NotifKind;
  title: string;
  body?: string;
  ttlMs?: number;
  action?: { label: string; run(): void };
}

interface State {
  items: Notification[];
  push(opts: PushOpts): string;
  dismiss(id: string): void;
  clear(): void;
}

const DEFAULT_TTL = 6000;

export const useNotifications = create<State>((set, get) => ({
  items: [],

  push(opts) {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('frame.notifications.mute') === '1') return '';
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ttl = opts.ttlMs ?? DEFAULT_TTL;
    const n: Notification = {
      id,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      createdAt: Date.now(),
      ttlMs: ttl,
      action: opts.action
    };
    set((s) => ({ items: [n, ...s.items].slice(0, 12) }));
    if (ttl > 0) setTimeout(() => get().dismiss(id), ttl);
    return id;
  },

  dismiss(id) {
    set((s) => ({ items: s.items.filter((n) => n.id !== id) }));
  },

  clear() { set({ items: [] }); }
}));
