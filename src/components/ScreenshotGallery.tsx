import { useEffect, useState } from 'react';
import { useWorkspace } from '../store/workspace';
import type { ScreenshotEntry } from '../types/frame';

export function ScreenshotGallery() {
  const screenshots = useWorkspace((s) => s.screenshots);
  const refresh = useWorkspace((s) => s.refreshScreenshots);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<ScreenshotEntry | null>(null);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());

  useEffect(() => { void refresh(); }, [refresh]);

  // Lazy-load thumbnails for newly arrived entries (resized in main process to ~240px wide).
  useEffect(() => {
    let cancelled = false;
    const missing = screenshots.filter((s) => !thumbs.has(s.id));
    if (missing.length === 0) return;
    (async () => {
      for (const entry of missing) {
        if (cancelled) return;
        const dataUrl = await window.frame.screenshots.thumb(entry.id, 240);
        if (cancelled) return;
        if (dataUrl) {
          setThumbs((prev) => {
            const next = new Map(prev);
            next.set(entry.id, dataUrl);
            return next;
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [screenshots, thumbs]);

  async function openPreview(entry: ScreenshotEntry) {
    setPreviewEntry(entry);
    setPreviewSrc(await window.frame.screenshots.read(entry.id));
  }

  async function captureClipboard() {
    const entry = await window.frame.screenshots.captureFromClipboard('manual');
    if (!entry) {
      alert('Clipboard has no image right now.');
      return;
    }
    await refresh();
  }

  async function remove(entry: ScreenshotEntry) {
    await window.frame.screenshots.remove(entry.id);
    setThumbs((prev) => {
      const next = new Map(prev);
      next.delete(entry.id);
      return next;
    });
    if (previewEntry?.id === entry.id) {
      setPreviewEntry(null);
      setPreviewSrc(null);
    }
    await refresh();
  }

  function copyPath(entry: ScreenshotEntry) {
    void navigator.clipboard.writeText(entry.path);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">SCREENSHOT VAULT</span>
        <span className="panel-meta">{screenshots.length} stored · Ctrl+Shift+S to grab</span>
      </div>
      <div className="panel-actions">
        <button className="btn" onClick={captureClipboard}>📋 Grab clipboard</button>
        <button className="btn subtle" onClick={refresh}>↻ Refresh</button>
      </div>

      <div className="snap-grid">
        {screenshots.length === 0 && <div className="muted">no snapshots yet — Ctrl+Shift+S grabs current clipboard image</div>}
        {screenshots.map((s) => {
          const thumb = thumbs.get(s.id);
          return (
            <div key={s.id} className="snap-card">
              <button className="snap-thumb" onClick={() => openPreview(s)} title="open full preview">
                {thumb ? <img src={thumb} alt={`${s.width}×${s.height}`} /> : <span className="snap-thumb-loading">·</span>}
                <span className="snap-meta-overlay">{s.width}×{s.height}</span>
              </button>
              <div className="snap-meta">
                <span className="snap-source">{s.source}</span>
                <span className="snap-time">{new Date(s.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="snap-actions">
                <button className="snap-action" onClick={() => copyPath(s)} title="copy path">📋</button>
                <button className="snap-action" onClick={() => remove(s)} title="delete">×</button>
              </div>
            </div>
          );
        })}
      </div>

      {previewEntry && (
        <div className="preview-overlay" onClick={() => { setPreviewEntry(null); setPreviewSrc(null); }}>
          <div className="preview-box" onClick={(e) => e.stopPropagation()}>
            <div className="preview-head">
              <span>{previewEntry.width}×{previewEntry.height} · {(previewEntry.bytes / 1024).toFixed(1)} KB</span>
              <button className="btn subtle" onClick={() => copyPath(previewEntry)}>copy path</button>
              <button className="btn subtle" onClick={() => { setPreviewEntry(null); setPreviewSrc(null); }}>close</button>
            </div>
            {previewSrc && <img src={previewSrc} alt="screenshot preview" />}
          </div>
        </div>
      )}
    </div>
  );
}
