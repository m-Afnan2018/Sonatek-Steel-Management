'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Trash2 } from 'lucide-react';
import { uploadFile } from '@/lib/api';
import type { Attachment } from '@/types';
import styles from './AudioRecorder.module.css';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

interface Props {
  attachments: Attachment[];
  canEdit: boolean;
  onSaved: (attachment: Attachment) => Promise<void>;
  onDelete: (idx: number) => Promise<void>;
}

function isAudio(a: Attachment): boolean {
  return /\.(webm|ogg|mp3|m4a|wav|aac)$/i.test(a.name);
}

function audioLabel(name: string): string {
  const match = name.match(/voice-note-(\d+)/);
  if (match) {
    return new Date(parseInt(match[1])).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
  return name;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function audioSrc(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

export default function AudioRecorder({ attachments, canEdit, onSaved, onDelete }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const audioNotes = attachments.filter(isAudio);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const startRecording = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Audio recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const ext = mimeType?.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
          type: mimeType || 'audio/webm',
        });

        setUploading(true);
        try {
          const data = await uploadFile(file);
          await onSaved({
            name: data.name,
            url: data.url,
            type: 'file',
            uploadedAt: new Date().toISOString(),
          });
        } catch {
          setError('Upload failed. Please try again.');
        } finally {
          setUploading(false);
        }
      };

      mr.start(100);
      mrRef.current = mr;
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    } catch {
      setError('Microphone access denied. Please allow mic permission.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mrRef.current?.stop();
    mrRef.current = null;
    setIsRecording(false);
    setElapsed(0);
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>Voice Notes</span>
        {canEdit && (
          uploading ? (
            <span className={styles.uploading}>
              <Loader2 size={13} className={styles.spin} />
              Saving…
            </span>
          ) : isRecording ? (
            <div className={styles.recordingRow}>
              <span className={styles.recDot} />
              <span className={styles.recTime}>{fmt(elapsed)}</span>
              <button className={styles.stopBtn} onClick={stopRecording}>
                <Square size={11} fill="currentColor" />
                Stop
              </button>
            </div>
          ) : (
            <button className={styles.micBtn} onClick={startRecording}>
              <Mic size={13} />
              Record
            </button>
          )
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {audioNotes.length === 0 && !isRecording && !uploading ? (
        <p className={styles.empty}>No voice notes yet.</p>
      ) : (
        <div className={styles.list}>
          {audioNotes.map((a, i) => {
            const allIdx = attachments.indexOf(a);
            return (
              <div key={i} className={styles.audioItem}>
                <div className={styles.audioMeta}>
                  <Mic size={11} className={styles.audioIcon} />
                  <span className={styles.audioLabel}>{audioLabel(a.name)}</span>
                </div>
                <audio
                  controls
                  src={audioSrc(a.url)}
                  className={styles.player}
                  preload="metadata"
                />
                {canEdit && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => onDelete(allIdx)}
                    title="Delete voice note"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
