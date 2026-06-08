'use client';

import { useState, useRef, useEffect } from 'react';
import api, { uploadFile } from '@/lib/api';
import Avatar from '@/components/ui/Avatar/Avatar';
import Button from '@/components/ui/Button/Button';
import { timeAgo } from '@/lib/utils';
import type { Contribution, Attachment, Task } from '@/types';
import styles from './GroupContributions.module.css';

interface Props {
  task: Task;
  currentUserId: string;
  onContributionSaved: () => void;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

function resolveUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function formatElapsed(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Identical to TaskModal ACTION_META
const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  start:  { label: 'Started',  color: '#10b981', bg: '#d1fae5' },
  resume: { label: 'Resumed',  color: '#0ea5e9', bg: '#e0f2fe' },
  pause:  { label: 'Paused',   color: '#f59e0b', bg: '#fef3c7' },
  hold:   { label: 'On Hold',  color: '#f97316', bg: '#ffedd5' },
  finish: { label: 'Finished', color: '#8b5cf6', bg: '#ede9fe' },
};

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function GroupContributions({ task, currentUserId, onContributionSaved }: Props) {
  const isAssignee = task.assignees.filter(Boolean).some(
    (a) => ((a as any)._id?.toString() || (a as any).id) === currentUserId,
  );

  const existing = (task.contributions ?? []).find(
    (c) => ((c.user as any)?._id?.toString() || (c.user as any)?.id) === currentUserId,
  );

  const [content, setContent] = useState(existing?.content ?? '');
  const [links, setLinks] = useState<string[]>(existing?.links ?? []);
  const [linkInput, setLinkInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>(existing?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [doneActing, setDoneActing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = (task.contributions ?? []).find(
      (c) => ((c.user as any)?._id?.toString() || (c.user as any)?.id) === currentUserId,
    );
    if (c) {
      setContent(c.content ?? '');
      setLinks(c.links ?? []);
      setAttachments(c.attachments ?? []);
    }
  }, [task.contributions, currentUserId]);

  const addLink = () => {
    const url = linkInput.trim();
    if (!url || links.includes(url)) return;
    setLinks((prev) => [...prev, url]);
    setLinkInput('');
  };

  const handleUpload = async (files: FileList | File[]) => {
    setUploadError('');
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const data = await uploadFile(file);
        setAttachments((prev) => [...prev, { name: data.name, url: data.url, type: data.type, uploadedAt: new Date().toISOString() }]);
      }
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    setSaveError('');
    setSaving(true);
    try {
      await api.post(`/tasks/${task._id}/contribute`, { content, attachments, links });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onContributionSaved();
    } catch (e: any) {
      setSaveError(e?.response?.data?.message ?? 'Could not save contribution.');
    } finally {
      setSaving(false);
    }
  };

  const handleDoneToggle = async () => {
    setDoneActing(true);
    try {
      await api.patch(`/tasks/${task._id}/contribute/done`);
      onContributionSaved();
    } finally {
      setDoneActing(false);
    }
  };

  const contributions = task.contributions ?? [];

  return (
    <div className={styles.root}>

      {/* ── Assignee form ── */}
      {isAssignee && (
        <div className={styles.formCard}>
          <div className={styles.formTitleRow}>
            <p className={styles.formTitle}>
              {existing ? 'Your contribution' : 'Add your contribution'}
            </p>
            {existing?.isDone && <span className={styles.doneBadge}>Done ✓</span>}
          </div>

          <div className={styles.formBody}>
            <button
              className={`${styles.doneToggle} ${existing?.isDone ? styles.doneToggleActive : ''}`}
              onClick={handleDoneToggle}
              disabled={doneActing}
            >
              {existing?.isDone ? '✓ Marked as Done — click to reopen' : '○ Mark as Done'}
            </button>

            <div className={styles.field}>
              <label className={styles.label}>Research notes</label>
              <textarea className={styles.textarea} rows={5} value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share your research findings, notes, or insights…" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Links</label>
              <div className={styles.linkRow}>
                <input className={styles.input} value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)} placeholder="https://..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
                <Button size="sm" variant="secondary" onClick={addLink} disabled={!linkInput.trim()}>Add</Button>
              </div>
              {links.length > 0 && (
                <div className={styles.linkList}>
                  {links.map((url, i) => (
                    <div key={i} className={styles.linkItem}>
                      <span>🔗</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkUrl}>{url}</a>
                      <button className={styles.removeBtn} onClick={() => setLinks((p) => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Media &amp; files</label>
              <input ref={fileInputRef} type="file" multiple className={styles.fileInputHidden}
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" />
              <div className={`${styles.dropZone} ${uploading ? styles.dropZoneUploading : ''}`}
                onClick={() => !uploading && fileInputRef.current?.click()}>
                <span>{uploading ? '⏳' : '📎'}</span>
                <span className={styles.dropZoneText}>
                  {uploading ? 'Uploading…' : <><u>Click to browse</u> or drag &amp; drop</>}
                </span>
              </div>
              {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
              {attachments.length > 0 && (
                <div className={styles.attachList}>
                  {attachments.map((a, i) => (
                    <div key={i} className={styles.attachItem}>
                      {a.type === 'image'
                        ? <a href={resolveUrl(a.url)} target="_blank" rel="noopener noreferrer" className={styles.attachThumb}><img src={resolveUrl(a.url)} alt={a.name} /></a>
                        : <span>📄</span>}
                      <a href={resolveUrl(a.url)} target="_blank" rel="noopener noreferrer" className={styles.attachName}>{a.name}</a>
                      <button className={styles.removeBtn} onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {saveError && <p className={styles.saveError}>{saveError}</p>}
            <div className={styles.formActions}>
              {saved && <span className={styles.savedMsg}>Saved!</span>}
              <Button onClick={handleSubmit} loading={saving} disabled={uploading || saving}>
                {existing ? 'Update Contribution' : 'Submit Contribution'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contributions list ── */}
      <div className={styles.contributionsList}>
        <p className={styles.sectionLabel}>
          {contributions.length === 0
            ? 'No contributions yet.'
            : `${contributions.length} contribution${contributions.length !== 1 ? 's' : ''}`}
        </p>
        {contributions.map((c) => (
          <ContributionCard key={c._id} contribution={c} resolveUrl={resolveUrl} />
        ))}
      </div>
    </div>
  );
}

function ContributionCard({ contribution: c, resolveUrl }: { contribution: Contribution; resolveUrl: (u: string) => string }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const userName = (c.user as any)?.name || 'Unknown';
  const totalElapsed = c.totalElapsedSeconds ?? 0;

  // Build enriched entries with duration labels — identical logic to TaskModal's Timeline tab
  const timelineEntries = (c.timerEvents ?? []).map((ev, i, arr) => {
    const prev = i > 0 ? arr[i - 1] : null;
    const durationMs = prev ? new Date(ev.timestamp).getTime() - new Date(prev.timestamp).getTime() : null;
    let durationLabel: string | null = null;
    if (durationMs !== null && durationMs >= 0) {
      if (prev!.action === 'start' || prev!.action === 'resume') {
        durationLabel = `Worked for ${fmtDuration(durationMs)}`;
      } else if (prev!.action === 'pause' || prev!.action === 'hold') {
        durationLabel = `Inactive for ${fmtDuration(durationMs)}`;
      }
    }
    return { ...ev, durationLabel };
  });

  return (
    <div className={`${styles.contribCard} ${c.isDone ? styles.contribCardDone : ''}`}>
      <div className={styles.contribHeader}>
        <Avatar name={userName} size="sm" />
        <div className={styles.contribMeta}>
          <span className={styles.contribName}>{userName}</span>
          <span className={styles.contribTime}>{timeAgo(c.updatedAt || c.submittedAt)}</span>
        </div>
        <div className={styles.contribBadges}>
          {c.isDone
            ? <span className={styles.doneBadge}>Done ✓</span>
            : <span className={styles.inProgressBadge}>In Progress</span>}
          {totalElapsed > 0 && (
            <span className={styles.elapsedBadge}>
              ⏱ {formatElapsed(totalElapsed)}{c.timerStatus === 'running' ? ' ●' : ''}
            </span>
          )}
        </div>
      </div>

      <div className={styles.contribBody}>
        {c.content && <p className={styles.contribContent}>{c.content}</p>}

        {c.links.length > 0 && (
          <div className={styles.contribLinks}>
            {c.links.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.contribLink}>
                🔗 {url}
              </a>
            ))}
          </div>
        )}

        {c.attachments.length > 0 && (
          <div className={styles.contribAttachments}>
            {c.attachments.map((a, i) => (
              <a key={i} href={resolveUrl(a.url)} target="_blank" rel="noopener noreferrer" className={styles.contribAttach}>
                {a.type === 'image'
                  ? <img src={resolveUrl(a.url)} alt={a.name} className={styles.contribAttachImg} />
                  : <span className={styles.contribAttachFile}>📄 {a.name}</span>}
              </a>
            ))}
          </div>
        )}

        {!c.content && c.links.length === 0 && c.attachments.length === 0 && timelineEntries.length === 0 && (
          <p className={styles.contribEmpty}>No content submitted yet.</p>
        )}
      </div>

      {/* Timeline — identical design to TaskModal's Timeline tab */}
      {timelineEntries.length > 0 && (
        <div className={styles.timelineSection}>
          <button className={styles.timelineToggle} onClick={() => setShowTimeline((v) => !v)}>
            {showTimeline ? '▲' : '▼'}&nbsp;Timer Activity · {timelineEntries.length} event{timelineEntries.length !== 1 ? 's' : ''}
          </button>

          {showTimeline && (
            <div className={styles.timeline}>
              {timelineEntries.map((ev, i) => {
                const meta = ACTION_META[ev.action] ?? { label: ev.action, color: '#6366f1', bg: '#eef2ff' };
                const isLast = i === timelineEntries.length - 1;
                return (
                  <div key={i} className={styles.timelineItem}>
                    <div className={styles.timelineSpine}>
                      <span className={styles.timelineDot}
                        style={{ background: meta.color, boxShadow: `0 0 0 3px ${meta.bg}` }} />
                      {!isLast && <div className={styles.timelineLine} />}
                    </div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineHeader}>
                        <span className={styles.timelineAction} style={{ color: meta.color, background: meta.bg }}>
                          {meta.label}
                        </span>
                        <span className={styles.timelineTime}>{fmtDateTime(ev.timestamp)}</span>
                      </div>
                      {ev.durationLabel && <span className={styles.timelineDuration}>{ev.durationLabel}</span>}
                    </div>
                  </div>
                );
              })}
              <div className={styles.timelineSummary}>
                ⏱ Total time logged: <strong>{formatElapsed(totalElapsed)}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
