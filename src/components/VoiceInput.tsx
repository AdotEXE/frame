import { useEffect, useRef, useState } from 'react';

// Hold-to-talk voice input. Uses the browser / Electron's built-in
// SpeechRecognition API. Streams interim results as the user speaks,
// flushes the finalised transcript into `onResult` when released.

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: (e: { error: string }) => void;
  start(): void;
  stop(): void;
}

interface W {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as W;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Props {
  lang?: string;
  onResult(text: string): void;
  onInterim?(text: string): void;
  className?: string;
  title?: string;
}

export function VoiceInput({ lang = 'ru-RU', onResult, onInterim, className, title }: Props) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');

  useEffect(() => { setSupported(!!getRecognitionCtor()); }, []);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      finalRef.current = '';
      rec.onresult = (e) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const alt = e.results[i][0];
          if (e.results[i].isFinal) final += alt.transcript;
          else interim += alt.transcript;
        }
        if (final) finalRef.current += final;
        if (onInterim) onInterim((finalRef.current + interim).trim());
      };
      rec.onend = () => {
        const text = finalRef.current.trim();
        if (text) onResult(text);
        finalRef.current = '';
        setRecording(false);
      };
      rec.onerror = (e) => {
        console.warn('[voice]', e.error);
        setRecording(false);
      };
      rec.start();
      recognitionRef.current = rec;
      setRecording(true);
    } catch (err) {
      console.warn('[voice] start failed', err);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      className={`voice-btn ${recording ? 'recording' : ''} ${className ?? ''}`}
      title={title ?? 'hold to talk'}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={() => { if (recording) stop(); }}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={(e) => { e.preventDefault(); stop(); }}
    >
      <span className="voice-dot" />
      🎤
    </button>
  );
}
