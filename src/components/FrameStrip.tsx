import { useEffect, useState } from 'react';

interface Pass {
  kind: 'base' | 'zoom';
  fps: number;
  width: number;
  startSec?: number;
  endSec?: number;
  frames: string[];
}

interface Props {
  pass: Pass;
  index: number;
}

export function FrameStrip({ pass, index }: Props) {
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [zoom, setZoom] = useState<{ src: string; path: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadVisible = async () => {
      const slice = pass.frames.slice(0, 80);
      const next = new Map<string, string>();
      for (const f of slice) {
        if (cancelled) return;
        const dataUrl = await window.frame.video.readFrame(f);
        if (dataUrl) next.set(f, dataUrl);
      }
      if (!cancelled) setThumbs(next);
    };
    void loadVisible();
    return () => { cancelled = true; };
  }, [pass.frames]);

  function copy(framePath: string) {
    void navigator.clipboard.writeText(framePath);
  }

  const kindLabel = pass.kind === 'zoom'
    ? `zoom ${pass.startSec}-${pass.endSec}s @ ${pass.fps}fps ${pass.width}px`
    : `base @ ${pass.fps}fps ${pass.width}px`;

  return (
    <div className="frame-strip-block">
      <div className="frame-strip-head">
        <span className="frame-strip-kind">pass {index} · {pass.kind}</span>
        <span className="frame-strip-spec">{kindLabel}</span>
        <span className="frame-strip-count">{pass.frames.length} frames</span>
      </div>
      <div className="frame-strip-scroll">
        {pass.frames.slice(0, 80).map((f, i) => {
          const src = thumbs.get(f);
          return (
            <button
              key={f}
              className="frame-thumb"
              title={`${i.toString().padStart(4, '0')} · click to copy path`}
              onClick={() => copy(f)}
              onDoubleClick={() => src && setZoom({ src, path: f })}
            >
              {src ? <img src={src} alt={`frame ${i}`} /> : <span className="frame-thumb-loading">·</span>}
              <span className="frame-thumb-idx">{i}</span>
            </button>
          );
        })}
        {pass.frames.length > 80 && (
          <div className="frame-overflow">+{pass.frames.length - 80} more</div>
        )}
      </div>
      {zoom && (
        <div className="preview-overlay" onClick={() => setZoom(null)}>
          <div className="preview-box" onClick={(e) => e.stopPropagation()}>
            <div className="preview-head">
              <span className="muted">{zoom.path}</span>
              <button className="btn subtle" onClick={() => copy(zoom.path)}>copy path</button>
              <button className="btn subtle" onClick={() => setZoom(null)}>close</button>
            </div>
            <img src={zoom.src} alt="frame zoom" />
          </div>
        </div>
      )}
    </div>
  );
}
