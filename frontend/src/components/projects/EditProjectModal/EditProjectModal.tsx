'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import api from '@/lib/api';
import type { Project, User } from '@/types';
import styles from './EditProjectModal.module.css';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
);

const STATIC_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
).replace(/\/api$/, '');

interface Props {
  isOpen: boolean;
  project: Project;
  members: User[];
  onClose: () => void;
  onSaved: (updated: Project) => void;
}

/* ── Success overlay ──────────────────────────────────────────────────── */
function SuccessPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.successOverlay} onClick={onClose}>
      <div className={styles.successPopup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.lottieWrap}>
          <DotLottieReact
            src="/success-lottie.json"
            autoplay
            loop={false}
            style={{ width: 130, height: 130 }}
          />
        </div>
        <h3 className={styles.successTitle}>Project Updated!</h3>
        <p className={styles.successMsg}>Your changes have been saved.</p>
        <Button size="sm" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────────────── */
export default function EditProjectModal({ isOpen, project, members, onClose, onSaved }: Props) {
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus]           = useState<Project['status']>('planning');
  const [priority, setPriority]       = useState<Project['priority']>('medium');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [tagsInput, setTagsInput]     = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  /* Thumbnail */
  const [existingThumb, setExistingThumb] = useState('');
  const [thumbFile, setThumbFile]         = useState<File | null>(null);
  const [thumbPreview, setThumbPreview]   = useState('');
  const [isDragging, setIsDragging]       = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  /* Submission */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  /* Populate fields when project prop changes */
  useEffect(() => {
    if (!project) return;
    setTitle(project.title || '');
    setDescription(project.description || '');
    setStatus(project.status || 'planning');
    setPriority(project.priority || 'medium');
    setStartDate(project.startDate ? project.startDate.slice(0, 10) : '');
    setEndDate(project.endDate ? project.endDate.slice(0, 10) : '');
    setTagsInput(project.tags?.join(', ') || '');
    setSelectedMembers(
      project.members
        ?.map((m) => m.user?.id || (m.user as any)?._id?.toString() || '')
        .filter(Boolean) || []
    );
    setExistingThumb(project.thumbnail || '');
    setThumbFile(null);
    setThumbPreview('');
    setError('');
    setShowSuccess(false);
  }, [project, isOpen]);

  /* ── Thumbnail helpers ───────────────────────────────────────────── */
  const pickThumb = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setThumbFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setThumbPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setExistingThumb('');
  };

  const removeThumb = (e: React.MouseEvent) => {
    e.stopPropagation();
    setThumbFile(null);
    setThumbPreview('');
    setExistingThumb('');
    if (thumbInputRef.current) thumbInputRef.current.value = '';
  };

  /* ── Submit ──────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;
    setError('');
    setSubmitting(true);

    try {
      const { data: updated } = await api.put<Project>(`/projects/${project._id}`, {
        title: title.trim(),
        description,
        status,
        priority,
        startDate,
        endDate: endDate || null,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        members: selectedMembers.map((id) => ({ user: id, role: 'member' })),
        // Clear thumbnail if user removed it and didn't pick a new one
        ...((!thumbFile && !existingThumb) ? { thumbnail: '' } : {}),
      });

      /* Upload new thumbnail if one was chosen */
      let finalProject = updated;
      if (thumbFile) {
        const form = new FormData();
        form.append('thumbnail', thumbFile);
        const { data: thumbData } = await api.post(
          `/projects/${project._id}/thumbnail`,
          form,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        finalProject = thumbData.project ?? { ...updated, thumbnail: thumbData.thumbnail };
      }

      onSaved(finalProject);
      setShowSuccess(true);
    } catch {
      setError('Failed to save changes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    onClose();
  };

  const toggleMember = (id: string) =>
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );

  /* active preview: new pick > existing > nothing */
  const previewSrc = thumbPreview || (existingThumb ? `${STATIC_BASE}${existingThumb}` : '');

  return (
    <>
      <Modal isOpen={isOpen && !showSuccess} onClose={handleClose} title="Edit Project" size="md">
        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Thumbnail */}
          <div className={styles.field}>
            <label>
              Thumbnail
              <span className={styles.optional}>optional</span>
            </label>
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={styles.hiddenInput}
              onChange={(e) => { if (e.target.files?.[0]) pickThumb(e.target.files[0]); }}
            />
            {previewSrc ? (
              <div className={styles.thumbPreview}>
                <img src={previewSrc} alt="Thumbnail" className={styles.thumbImg} />
                <div className={styles.thumbActions}>
                  <button
                    type="button"
                    className={styles.thumbChange}
                    onClick={() => thumbInputRef.current?.click()}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className={styles.thumbRemove}
                    onClick={removeThumb}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`${styles.thumbDrop} ${isDragging ? styles.thumbDropActive : ''}`}
                onClick={() => thumbInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files[0]) pickThumb(e.dataTransfer.files[0]);
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.thumbDropIcon}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className={styles.thumbDropText}><u>Click to upload</u> or drag &amp; drop</span>
                <span className={styles.thumbDropSub}>JPG, PNG, WEBP — max 5 MB</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div className={styles.field}>
            <label>Title <span className={styles.req}>*</span></label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label>Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project description..."
            />
          </div>

          {/* Status + Priority */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Project['status'])}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Project['priority'])}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Start Date <span className={styles.req}>*</span></label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label>End Date <span className={styles.optional}>optional</span></label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Tags */}
          <div className={styles.field}>
            <label>Tags <span className={styles.optional}>comma separated</span></label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="frontend, design, api"
            />
          </div>

          {/* Members */}
          <div className={styles.field}>
            <label>Members</label>
            <div className={styles.memberList}>
              {members.map((m) => (
                <label key={m.id} className={styles.memberCheck}>
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.id)}
                    onChange={() => toggleMember(m.id)}
                  />
                  <span>{m.name}</span>
                  <span className={styles.memberRole}>{m.role}</span>
                </label>
              ))}
              {members.length === 0 && <p className={styles.noMembers}>No team members found.</p>}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Button variant="secondary" type="button" onClick={handleClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" loading={submitting} disabled={!title.trim() || !startDate}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {showSuccess && <SuccessPopup onClose={handleClose} />}
    </>
  );
}
