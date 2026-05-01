'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar/Avatar';
import { timeAgo } from '@/lib/utils';
import type { ChatMessage, ChatUser } from '@/store/chatStore';
import styles from './MessageBubble.module.css';
import { FileText, CornerUpLeft, CheckCheck, Check } from 'lucide-react';
import MessageContextMenu, { type ContextMenuPosition } from '../MessageContextMenu/MessageContextMenu';
import EmojiPicker from '../EmojiPicker/EmojiPicker';
import ReactionViewer from '../ReactionViewer/ReactionViewer';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

function uid(u: ChatUser | undefined | null): string {
  if (!u) return '';
  return (u._id || u.id) ?? '';
}

interface Props {
  msg: ChatMessage;
  currentUserId: string;
  showSender: boolean;
  conversationId: string;
  onReply: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msgId: string, forEveryone: boolean) => void;
  onForward: (msg: ChatMessage) => void;
  isPinned?: boolean;
  onPin?: (msgId: string) => void;
  isSaved?: boolean;
  onSave?: (msg: ChatMessage) => void;
}

interface ReactionViewerState {
  emoji: string;
  users: ChatUser[];
  rect: DOMRect;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({
  msg,
  currentUserId,
  showSender,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onForward,
  isPinned = false,
  onPin,
  isSaved = false,
  onSave,
}: Props) {
  const isSelf = uid(msg.sender) === currentUserId;

  const [contextMenu, setContextMenu]     = useState<ContextMenuPosition | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPos, setEmojiPickerPos]   = useState<{ top: number; left: number } | null>(null);
  const [reactionViewer, setReactionViewer]   = useState<ReactionViewerState | null>(null);

  // Inline edit state
  const [editing, setEditing]       = useState(false);
  const [editContent, setEditContent] = useState(msg.content || '');
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Long-press support for mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Auto-focus edit textarea
  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  // Close context menu / emoji picker on Escape handled inside their own components

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ x: touch.clientX, y: touch.clientY });
    }, 600);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleCopy = useCallback(() => {
    if (msg.content) {
      navigator.clipboard.writeText(msg.content).catch(() => {});
    }
  }, [msg.content]);

  const openEmojiPicker = useCallback(() => {
    if (!rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    const pickerH = 280;
    const pickerW = 280;
    const top = rect.top - pickerH > 0 ? rect.top - pickerH : rect.bottom;
    const left = isSelf
      ? Math.max(0, rect.right - pickerW)
      : Math.min(rect.left, window.innerWidth - pickerW);
    setEmojiPickerPos({ top, left });
    setShowEmojiPicker(true);
  }, [isSelf]);

  const handleEditSave = useCallback(() => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === msg.content) {
      setEditing(false);
      return;
    }
    onEdit({ ...msg, content: trimmed });
    setEditing(false);
  }, [editContent, msg, onEdit]);

  const handleReactionClick = useCallback((e: React.MouseEvent<HTMLButtonElement>, emoji: string, users: ChatUser[]) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setReactionViewer({ emoji, users, rect });
  }, []);

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
      ref={rowRef}
      className={`${styles.row} ${isSelf ? styles.rowSelf : ''}`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
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
            <span className={styles.replyName}>{(msg.replyTo as ChatMessage).sender?.name}</span>
            <span className={styles.replyText}>
              {(msg.replyTo as ChatMessage).deletedForEveryone
                ? '🚫 Deleted message'
                : (msg.replyTo as ChatMessage).content?.slice(0, 80)}
            </span>
          </div>
        )}

        <div className={`${styles.bubble} ${isSelf ? styles.bubbleSelf : styles.bubbleOther}`}>
          {/* Attachment(s) */}
          {msg.attachments?.length > 0 && (
            <div className={styles.attachments}>
              {msg.attachments.map((a, i) => {
                const src = `${API_BASE}${a.url}`;
                if (a.type === 'audio') {
                  return (
                    <div key={i} className={styles.audioWrap}>
                      <audio className={styles.audioPlayer} controls preload="none">
                        <source src={src} />
                      </audio>
                    </div>
                  );
                }
                if (a.type === 'image') {
                  return (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                      <img src={src} alt={a.name} className={styles.imgAttach} />
                    </a>
                  );
                }
                return (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer" className={styles.fileAttach}>
                    <FileText size={14} />
                    {a.name}
                  </a>
                );
              })}
            </div>
          )}

          {/* Text content — or inline edit */}
          {editing ? (
            <div className={styles.editArea}>
              <textarea
                ref={editRef}
                className={styles.editTextarea}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEditSave();
                  }
                  if (e.key === 'Escape') {
                    setEditing(false);
                    setEditContent(msg.content || '');
                  }
                }}
                rows={Math.max(2, (editContent.match(/\n/g) || []).length + 1)}
              />
              <div className={styles.editActions}>
                <button
                  className={styles.editCancelBtn}
                  onClick={() => { setEditing(false); setEditContent(msg.content || ''); }}
                >
                  Cancel
                </button>
                <button className={styles.editSaveBtn} onClick={handleEditSave}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            msg.content && <p className={styles.content}>{msg.content}</p>
          )}

          {/* Footer: time + edited + ticks */}
          <div className={styles.footer}>
            {msg.isEdited && !editing && <span className={styles.edited}>edited</span>}
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
                onClick={(e) => handleReactionClick(e, r.emoji, r.users)}
                title={r.users?.map((u) => u.name || u).join(', ')}
              >
                {r.emoji} {r.users?.length}
              </button>
            ))}
          </div>
        )}


      </div>

      {/* Context menu */}
      {contextMenu && (
        <MessageContextMenu
          position={contextMenu}
          isSelf={isSelf}
          onReply={() => onReply(msg)}
          onReact={() => { setContextMenu(null); openEmojiPicker(); }}
          onCopy={handleCopy}
          onEdit={() => { setEditing(true); setEditContent(msg.content || ''); }}
          onDeleteForMe={() => onDelete(msg._id, false)}
          onDeleteForEveryone={() => onDelete(msg._id, true)}
          onForward={() => onForward(msg)}
          onClose={() => setContextMenu(null)}
          isPinned={isPinned}
          onPin={onPin ? () => onPin(msg._id) : undefined}
          isSaved={isSaved}
          onSave={onSave ? () => onSave(msg) : undefined}
        />
      )}

      {/* Emoji picker portal */}
      {showEmojiPicker && emojiPickerPos && (
        <div
          className={styles.emojiPickerPortal}
          style={{ top: emojiPickerPos.top, left: emojiPickerPos.left }}
        >
          <EmojiPicker
            onSelect={(emoji) => { onReact(msg._id, emoji); setShowEmojiPicker(false); }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {/* Reaction viewer */}
      {reactionViewer && (
        <ReactionViewer
          emoji={reactionViewer.emoji}
          users={reactionViewer.users}
          currentUserId={currentUserId}
          onToggle={() => onReact(msg._id, reactionViewer.emoji)}
          onClose={() => setReactionViewer(null)}
          anchorRect={reactionViewer.rect}
        />
      )}
    </div>
  );
}
