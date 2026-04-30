'use client';

import { useState } from 'react';
import Avatar from '@/components/ui/Avatar/Avatar';
import { timeAgo } from '@/lib/utils';
import type { ChatMessage, ChatUser } from '@/store/chatStore';
import styles from './MessageBubble.module.css';
import { FileText, CornerUpLeft, CheckCheck, Check } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

function uid(u: ChatUser | any): string {
  return (u?._id || u?.id)?.toString() ?? '';
}

interface Props {
  msg: ChatMessage;
  currentUserId: string;
  showSender: boolean; // true in group chats
  onReply: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({ msg, currentUserId, showSender, onReply, onReact }: Props) {
  const isSelf = uid(msg.sender) === currentUserId;
  const [showReactions, setShowReactions] = useState(false);

  if (msg.deletedForEveryone) {
    return (
      <div className={`${styles.row} ${isSelf ? styles.rowSelf : ''}`}>
        <p className={styles.deleted}>🚫 This message was deleted</p>
      </div>
    );
  }

  const seenByOthers = msg.seenBy?.some((s) => s.user !== currentUserId);

  return (
    <div
      className={`${styles.row} ${isSelf ? styles.rowSelf : ''}`}
      onMouseLeave={() => setShowReactions(false)}
    >
      {!isSelf && (
        <Avatar name={msg.sender?.name || '?'} size="sm" className={styles.avatar} />
      )}

      <div className={styles.bubble_wrap}>
        {showSender && !isSelf && (
          <span className={styles.senderName}>{msg.sender?.name}</span>
        )}

        {/* Reply preview */}
        {msg.replyTo && (
          <div className={styles.replyPreview}>
            <span className={styles.replyName}>{(msg.replyTo as any).sender?.name}</span>
            <span className={styles.replyText}>
              {(msg.replyTo as any).deletedForEveryone
                ? '🚫 Deleted message'
                : (msg.replyTo as any).content?.slice(0, 80)}
            </span>
          </div>
        )}

        <div
          className={`${styles.bubble} ${isSelf ? styles.bubbleSelf : styles.bubbleOther}`}
          onMouseEnter={() => setShowReactions(true)}
        >
          {/* Attachment(s) */}
          {msg.attachments?.length > 0 && (
            <div className={styles.attachments}>
              {msg.attachments.map((a, i) => (
                a.type === 'image' ? (
                  <a key={i} href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer">
                    <img src={`${API_BASE}${a.url}`} alt={a.name} className={styles.imgAttach} />
                  </a>
                ) : (
                  <a key={i} href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer" className={styles.fileAttach}>
                    <FileText size={14} />
                    {a.name}
                  </a>
                )
              ))}
            </div>
          )}

          {/* Text content */}
          {msg.content && (
            <p className={styles.content}>{msg.content}</p>
          )}

          {/* Footer: time + edited + ticks */}
          <div className={styles.footer}>
            {msg.isEdited && <span className={styles.edited}>edited</span>}
            <span className={styles.time}>{timeAgo(msg.createdAt)}</span>
            {isSelf && (
              <span className={styles.ticks} title={seenByOthers ? 'Seen' : 'Delivered'}>
                {seenByOthers ? (
                  <CheckCheck size={14} color="#4fc3f7" />
                ) : (
                  <Check size={14} opacity={0.6} />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reaction bar */}
        {msg.reactions?.length > 0 && (
          <div className={styles.reactions}>
            {msg.reactions.map((r) => (
              <button
                key={r.emoji}
                className={styles.reaction}
                onClick={() => onReact(msg._id, r.emoji)}
                title={r.users?.map((u: any) => u.name || u).join(', ')}
              >
                {r.emoji} {r.users?.length}
              </button>
            ))}
          </div>
        )}

        {/* Hover actions */}
        {showReactions && (
          <div className={`${styles.hoverActions} ${isSelf ? styles.hoverActionsSelf : ''}`}>
            <button className={styles.replyBtn} onClick={() => onReply(msg)} title="Reply">
              <CornerUpLeft size={13} />
            </button>
            {QUICK_EMOJIS.map((e) => (
              <button key={e} className={styles.emojiBtn} onClick={() => { onReact(msg._id, e); setShowReactions(false); }}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
