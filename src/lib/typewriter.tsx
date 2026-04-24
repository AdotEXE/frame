import { useEffect, useRef, useState } from 'react';

// useTypewriter — reveals `text` one character at a time. Resets when text changes.
export function useTypewriter(text: string, speedMs = 18): { out: string; done: boolean } {
  const [out, setOut] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setOut('');
    setDone(false);
    if (!text) { setDone(true); return; }
    let i = 0;
    const len = text.length;
    const tick = () => {
      // Advance by 1–3 chars per tick — keeps long lines fast without sacrificing the effect.
      const step = Math.max(1, Math.floor(len / 60));
      i = Math.min(len, i + step);
      setOut(text.slice(0, i));
      if (i >= len) setDone(true);
    };
    const id = setInterval(() => {
      tick();
      if (i >= len) clearInterval(id);
    }, speedMs);
    return () => clearInterval(id);
  }, [text, speedMs]);

  return { out, done };
}

interface TypewriterTextProps {
  text: string;
  speedMs?: number;
  cursor?: boolean;
  className?: string;
}

export function TypewriterText({ text, speedMs, cursor = true, className }: TypewriterTextProps) {
  const { out, done } = useTypewriter(text, speedMs);
  return (
    <span className={className}>
      {out}
      {cursor && !done && <span className="typewriter-cursor">▌</span>}
    </span>
  );
}

// useCountUp — animates `target` from previous value to new value over `durMs`.
export function useCountUp(target: number, durMs = 600): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const startAt = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startAt) / durMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      setVal(v);
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durMs]);

  return val;
}
