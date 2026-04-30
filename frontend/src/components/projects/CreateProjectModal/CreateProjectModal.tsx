'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import api from '@/lib/api';
import type { User } from '@/types';
import styles from './CreateProjectModal.module.css';
import { X, Image } from 'lucide-react';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
);

const STATIC_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
).replace(/\/api$/, '');

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    priority: string;
    startDate: string;
    endDate: string;
    members: { user: string; role: string }[];
    tags: string[];
  }) => Promise<{ _id: string } | undefined>;
  members: User[];
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
        <h3 className={styles.successTitle}>Project Created!</h3>
        <p className={styles.successMsg}>Your new project is ready to go.</p>
        <Button size="sm" onClick={onClose}>Let's go</Button>
      </div>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────────────── */
export default function CreateProjectModal({
  isOpen,
  onClose,
  onSubmit,
  members,
}: CreateProjectModalProps) {
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [priority, setPriority]         = useState('medium');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [tagsInput, setTagsInput]       = useState('');

  /* Thumbnail */
  const [thumbFile, setThumbFile]       = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string>('');
  const [isDragging, setIsDragging]     = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  /* Submission */
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [showSuccess, setShowSuccess]   = useState(false);

  /* ── Thumbnail helpers ───────────────────────────────────────────── */
  const pickThumb = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setThumbFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setThumbPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeThumb = (e: React.MouseEvent) => {
    e.stopPropagation();
    setThumbFile(null);
    setThumbPreview('');
    if (thumbInputRef.current) thumbInputRef.current.value = '';
  };

  /* ── Submit ──────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;
    setError('');
    setSubmitting(true);

    try {
      const project = await onSubmit({
        title: title.trim(),
        description,
        priority,
        startDate,
        endDate,
        members: selectedMembers.map((id) => ({ user: id, role: 'member' })),
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      });

      /* Upload thumbnail if one was chosen */
      if (thumbFile && project?._id) {
        const form = new FormData();
        form.append('thumbnail', thumbFile);
        await api.post(`/projects/${project._id}/thumbnail`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      /* Show success — reset happens on close */
      setShowSuccess(true);
    } catch {
      setError('Failed to create project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setTitle(''); setDescription(''); setPriority('medium');
    setStartDate(''); setEndDate(''); setSelectedMembers([]);
    setTagsInput(''); setThumbFile(null); setThumbPreview('');
    setError(''); setShowSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleMember = (id: string) =>
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <>
      <Modal isOpen={isOpen && !showSuccess} onClose={handleClose} title="Create Project" size="md">
        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Thumbnail picker */}
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
            {thumbPreview ? (
              <div className={styles.thumbPreview}>
                <img src={thumbPreview} alt="Thumbnail preview" className={styles.thumbImg} />
                <button
                  type="button"
                  className={styles.thumbRemove}
                  onClick={removeThumb}
                  title="Remove thumbnail"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
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
                  const file = e.dataTransfer.files[0];
                  if (file) pickThumb(file);
                }}
              >
                <Image size={22} strokeWidth={1.5} className={styles.thumbDropIcon} />
                <span className={styles.thumbDropText}>
                  <u>Click to upload</u> or drag &amp; drop
                </span>
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

          {/* Priority + Dates */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Start Date <span className={styles.req}>*</span></label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label>
                End Date
                <span className={styles.optional}>optional</span>
              </label>
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
              {members.length === 0 && (
                <p className={styles.noMembers}>No team members found.</p>
              )}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Button variant="secondary" type="button" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!title.trim() || !startDate}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Success overlay — rendered outside the modal */}
      {showSuccess && <SuccessPopup onClose={handleClose} />}
    </>
  );
}
