import { useEffect, useState } from 'react';
import { useWorkspace } from '../store/workspace';

interface Progress {
  jobId: string;
  progress: number;
}

export function VideoPanel() {
  const jobs = useWorkspace((s) => s.videoJobs);
  const refresh = useWorkspace((s) => s.refreshVideoJobs);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [fps, setFps] = useState(1);
  const [width, setWidth] = useState(960);
  const [zoomFps, setZoomFps] = useState(5);
  const [zoomWidth, setZoomWidth] = useState(1280);
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(5);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    const off = window.frame.video.onProgress(setProgress);
    const offFrames = window.frame.video.onFrames(() => { void refresh(); });
    return () => { off(); offFrames(); };
  }, [refresh]);

  async function pickAndExtract() {
    const file = await window.frame.video.select();
    if (!file) return;
    setBusy(true);
    try {
      const r = await window.frame.video.extract(file, { fps, width });
      setActiveJobId(r.jobId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function zoom() {
    if (!activeJobId) return;
    setBusy(true);
    try {
      await window.frame.video.zoom(activeJobId, { startSec: zoomStart, endSec: zoomEnd, fps: zoomFps, width: zoomWidth });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">VIDEO → FRAMES</span>
        <span className="panel-meta">adaptive multi-pass extraction</span>
      </div>

      <div className="video-section">
        <div className="video-row">
          <label>base fps <input type="number" min={0.1} step={0.1} value={fps} onChange={(e) => setFps(parseFloat(e.target.value))} /></label>
          <label>width <input type="number" min={120} step={20} value={width} onChange={(e) => setWidth(parseInt(e.target.value, 10))} /></label>
          <button className="btn" onClick={pickAndExtract} disabled={busy}>📂 Pick video → extract</button>
        </div>
        {progress && <div className="video-progress"><div className="bar" style={{ width: `${Math.min(100, progress.progress)}%` }} /><span>{Math.round(progress.progress)}%</span></div>}
      </div>

      <div className="video-section">
        <div className="panel-head sub"><span>ZOOM-IN PASS</span><span className="panel-meta">{activeJobId ? `job ${activeJobId.slice(0, 8)}` : 'extract a video first'}</span></div>
        <div className="video-row">
          <label>start s <input type="number" min={0} step={0.5} value={zoomStart} onChange={(e) => setZoomStart(parseFloat(e.target.value))} /></label>
          <label>end s <input type="number" min={0} step={0.5} value={zoomEnd} onChange={(e) => setZoomEnd(parseFloat(e.target.value))} /></label>
          <label>fps <input type="number" min={1} step={1} value={zoomFps} onChange={(e) => setZoomFps(parseFloat(e.target.value))} /></label>
          <label>width <input type="number" min={240} step={40} value={zoomWidth} onChange={(e) => setZoomWidth(parseInt(e.target.value, 10))} /></label>
          <button className="btn" onClick={zoom} disabled={!activeJobId || busy}>🔍 Zoom in</button>
        </div>
      </div>

      <div className="panel-head"><span className="panel-title">JOBS</span><span className="panel-meta">{jobs.length}</span></div>
      <div className="job-list">
        {jobs.length === 0 && <div className="muted">no jobs yet</div>}
        {jobs.map((j) => (
          <div key={j.id} className={`job-card ${j.id === activeJobId ? 'active' : ''}`} onClick={() => setActiveJobId(j.id)}>
            <div className="job-source" title={j.source}>{j.source.split(/[\\/]/).pop()}</div>
            <div className="job-meta">
              <span>{j.totalFrames} frames</span>
              <span>{j.passCount} pass{j.passCount === 1 ? '' : 'es'}</span>
              <span>{j.baseFps} fps · {j.baseWidth}px</span>
            </div>
            <div className="job-out" title={j.outDir}>{j.outDir}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
