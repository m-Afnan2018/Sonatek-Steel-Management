'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { ChatMessage, MessageAttachment } from '@/store/chatStore';
import styles from './MessageInput.module.css';
import { CornerUpLeft, X, Send, Mic, MicOff, Paperclip, Image } from 'lucide-react';

interface Props {
  conversationId: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  onSend: (content: string, replyTo?: string, attachments?: MessageAttachment[]) => void;
  onTyping: (isTyping: boolean) => void;
}

export default function MessageInput({ conversationId, replyTo, onClearReply, onSend, onTyping }: Props) {
  const [text, setText] = useState('');
  const [recording, setRecording]   = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [uploading, setUploading]   = useState(false);

  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef    = useRef(false);
  const recTimerRef    = useRef<NodeJS.Timeout | null>(null);
  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    if (isTypingRef.current) { isTypingRef.current = false; onTyping(false); }
  }, [onTyping]);

  useEffect(() => {
    return () => stopTyping();
  }, [conversationId, stopTyping]);

  // ── Text handling ──────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    if (val.length > 0) {
      if (!isTypingRef.current) { isTypingRef.current = true; onTyping(true); }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false; typingTimerRef.current = null; onTyping(false);
      }, 2500);
    } else {
      stopTyping();
    }
  };

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content) return;
    onSend(content, replyTo?._id);
    setText('');
    onClearReply();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    stopTyping();
  }, [text, replyTo, onSend, onClearReply, stopTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── File upload helper ─────────────────────────────────────────────────────
  const uploadFile = async (file: File): Promise<MessageAttachment | null> => {
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<{ url: string; name: string }>('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const isImage = file.type.startsWith('image/');
      const isAudio = file.type.startsWith('audio/');
      return {
        name: file.name,
        url:  data.url,
        type: isImage ? 'image' : isAudio ? 'audio' : 'file',
        size: file.size,
      };
    } catch {
      return null;
    }
  };

  // ── File attachment ────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const attachments = (await Promise.all(files.map(uploadFile))).filter(Boolean) as MessageAttachment[];
    setUploading(false);
    if (attachments.length) onSend('', replyTo?._id, attachments);
    onClearReply();
    e.target.value = '';
  };

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setUploading(true);
        const attachment = await uploadFile(file);
        setUploading(false);
        if (attachment) onSend('', replyTo?._id, [attachment]);
        onClearReply();
      };
      rec.start(100);
      mediaRecRef.current = rec;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      alert('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    mediaRecRef.current?.stop();
    mediaRecRef.current = null;
    setRecording(false);
  };

  const cancelRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (mediaRecRef.current) {
      mediaRecRef.current.ondataavailable = null;
      mediaRecRef.current.onstop = null;
      mediaRecRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecRef.current.stop();
      mediaRecRef.current = null;
    }
    audioChunksRef.current = [];
    setRecording(false);
    setRecSeconds(0);
  };

  const formatRecTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      {replyTo && (
        <div className={styles.replyBar}>
          <div className={styles.replyBarContent}>
            <CornerUpLeft size={12} strokeWidth={2.5} />
            <div>
              <span className={styles.replyBarName}>{replyTo.sender?.name}</span>
              <span className={styles.replyBarText}>{replyTo.content?.slice(0, 60)}</span>
            </div>
          </div>
          <button className={styles.clearReply} onClick={onClearReply} aria-label="Cancel reply">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {recording ? (
        /* ── Recording UI ── */
        <div className={styles.recordingRow}>
          <div className={styles.recPulse} />
          <span className={styles.recTimer}>{formatRecTime(recSeconds)}</span>
          <span className={styles.recLabel}>Recording…</span>
          <button className={styles.recCancelBtn} onClick={cancelRecording} title="Cancel">
            <X size={16} />
          </button>
          <button className={styles.recStopBtn} onClick={stopRecording} title="Send voice message">
            <Send size={16} />
          </button>
        </div>
      ) : (
        /* ── Normal input row ── */
        <div className={styles.inputRow}>
          {/* Attachment buttons */}
          <div className={styles.attachBtns}>
            <button
              className={styles.attachBtn}
              onClick={() => imageInputRef.current?.click()}
              title="Send image"
              disabled={uploading}
            >
              <Image size={18} />
            </button>
            <button
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              disabled={uploading}
            >
              <Paperclip size={18} />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={1}
            placeholder={uploading ? 'Uploading…' : 'Type a message…'}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={uploading}
          />

          {text.trim() ? (
            <button className={styles.sendBtn} onClick={handleSend} aria-label="Send">
              <Send size={18} />
            </button>
          ) : (
            <button
              className={styles.micBtn}
              onClick={startRecording}
              aria-label="Record voice message"
              disabled={uploading}
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />
    </div>
  );
}
