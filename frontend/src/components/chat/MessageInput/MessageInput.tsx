'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage } from '@/store/chatStore';
import styles from './MessageInput.module.css';
import { CornerUpLeft, X, Send } from 'lucide-react';

interface Props {
  conversationId: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  onSend: (content: string, replyTo?: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export default function MessageInput({ conversationId, replyTo, onClearReply, onSend, onTyping }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Auto-focus when conversation changes
  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversationId]);

  // Stop typing and emit typing_stop — safe to call multiple times
  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping(false);
    }
  }, [onTyping]);

  // Stop typing when switching conversations
  useEffect(() => {
    return () => stopTyping();
  }, [conversationId, stopTyping]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';

    if (val.length > 0) {
      // Emit typing_start once per streak
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping(true);
      }
      // Reset the idle timer — stop after 2.5 s of no keystrokes
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        typingTimerRef.current = null;
        onTyping(false);
      }, 2500);
    } else {
      // Field cleared — stop immediately
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          placeholder="Type a message…"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
