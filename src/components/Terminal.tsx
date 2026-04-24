import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string;
}

export function Terminal({ sessionId }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new XTerm({
      fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: '#070a0f',
        foreground: '#cfe7ff',
        cursor: '#5af2c4',
        cursorAccent: '#070a0f',
        selectionBackground: '#1f3854',
        black: '#0b0f15',
        red: '#ff6b6b',
        green: '#5af2c4',
        yellow: '#f5c451',
        blue: '#62a0ff',
        magenta: '#c08eff',
        cyan: '#5fd7ff',
        white: '#cfe7ff',
        brightBlack: '#3a4150',
        brightRed: '#ff8a8a',
        brightGreen: '#7df5cf',
        brightYellow: '#ffd97a',
        brightBlue: '#8cc0ff',
        brightMagenta: '#d6b3ff',
        brightCyan: '#8ee5ff',
        brightWhite: '#f3f6fa'
      }
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(hostRef.current);
    termRef.current = term;
    fitRef.current = fit;
    requestAnimationFrame(() => {
      try { fit.fit(); } catch { /* host not measurable yet */ }
    });

    let mounted = true;
    void window.frame.pty.getBuffer(sessionId).then((buf) => {
      if (mounted && buf) term.write(buf);
    });

    const offData = window.frame.pty.onData(({ sessionId: sid, data }) => {
      if (sid === sessionId) term.write(data);
    });
    const offExit = window.frame.pty.onExit(({ sessionId: sid, code }) => {
      if (sid === sessionId) term.write(`\r\n[33m[session ended, code ${code}][0m\r\n`);
    });

    const inputDisp = term.onData((data) => { void window.frame.pty.write(sessionId, data); });
    const resizeDisp = term.onResize(({ cols, rows }) => { void window.frame.pty.resize(sessionId, cols, rows); });

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!hostRef.current || hostRef.current.clientWidth === 0) return;
        try { fit.fit(); } catch { /* host detached */ }
      });
    });
    ro.observe(hostRef.current);

    return () => {
      mounted = false;
      offData();
      offExit();
      inputDisp.dispose();
      resizeDisp.dispose();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  return <div ref={hostRef} className="xterm-host" />;
}
