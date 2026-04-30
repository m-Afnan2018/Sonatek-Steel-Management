'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Spinner from '@/components/ui/Spinner/Spinner';
import TaskModal from '@/components/projects/TaskModal/TaskModal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTeam } from '@/hooks/useTeam';
import { useTasks } from '@/hooks/useTasks';
import type { Task } from '@/types';
import styles from './MediaLibrary.module.css';
import { Search, LayoutGrid, List, Upload, Download, Pencil, Trash2, X, CheckSquare, ChevronLeft, ChevronRight, Image } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────── */

interface MediaItem {
  _id: string;
  name: string;
  originalName?: string;
  url: string;
  mimeType: string;
  size?: number;
  fileType: 'image' | 'document' | 'archive' | 'other';
  uploadedBy?: { id: string; name: string };
  task?: { id: string; title: string };
  source: 'library' | 'task' | 'thumbnail';
  createdAt: string;
}

interface Props {
  projectId: string;
}

/* ── Constants ──────────────────────────────────────────────────────── */

const STATIC_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
).replace(/\/api$/, '');

/* ── Helper functions ───────────────────────────────────────────────── */

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fileIcon(item: MediaItem): string {
  if (item.mimeType?.startsWith('video/')) return '🎬';
  if (item.mimeType?.startsWith('audio/')) return '🎵';
  switch (item.fileType) {
    case 'image':    return '🖼️';
    case 'document': return '📄';
    case 'archive':  return '🗜️';
    default:         return '📁';
  }
}

function mediaKind(item: MediaItem): 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other' {
  const m = item.mimeType || '';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('text/')) return 'text';
  // Fallback for task attachments that may lack a recognised mimeType
  if (item.fileType === 'image') return 'image';
  return 'other';
}

function canEdit(item: MediaItem, userId?: string, role?: string): boolean {
  if (role === 'admin' || role === 'manager') return true;
  // Task attachments and project thumbnails only editable by admin/manager
  if (item.source === 'task' || item.source === 'thumbnail') return false;
  return item.uploadedBy?.id === userId;
}

function canDelete(item: MediaItem, userId?: string, role?: string): boolean {
  // Thumbnail can only be changed via Edit Project, not deleted from media library
  if (item.source === 'thumbnail') return false;
  return canEdit(item, userId, role);
}

/* ── SVG Icons ──────────────────────────────────────────────────────── */

const SearchIcon = () => <Search size={15} />;

const GridIcon = () => <LayoutGrid size={15} />;

const ListIcon = () => <List size={15} />;

const UploadIcon = () => <Upload size={14} strokeWidth={2.5} />;

const DownloadIcon = () => <Download size={12} strokeWidth={2.5} />;

const PencilIcon = () => <Pencil size={12} strokeWidth={2.5} />;

const TrashIcon = () => <Trash2 size={12} strokeWidth={2.5} />;

/* ── File Viewer ────────────────────────────────────────────────────── */

function FileViewer({
  item,
  items,
  onClose,
  onViewTask,
}: {
  item: MediaItem;
  items: MediaItem[];
  onClose: () => void;
  onViewTask: (item: MediaItem) => void;
}) {
  const fileUrl = `${STATIC_BASE}${item.url}`;
  const kind = mediaKind(item);
  const idx = items.findIndex((i) => i._id === item._id);

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const renderContent = () => {
    switch (kind) {
      case 'image':
        return (
          <img
            src={fileUrl}
            alt={item.name}
            className={styles.viewerImage}
          />
        );

      case 'video':
        return (
          <video
            src={fileUrl}
            controls
            autoPlay={false}
            className={styles.viewerVideo}
          >
            Your browser does not support video playback.
          </video>
        );

      case 'audio':
        return (
          <div className={styles.viewerAudio}>
            <div className={styles.viewerAudioIcon}>🎵</div>
            <p className={styles.viewerAudioName}>{item.name}</p>
            <audio src={fileUrl} controls className={styles.viewerAudioPlayer}>
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      case 'pdf':
        return (
          <iframe
            src={fileUrl}
            title={item.name}
            className={styles.viewerPdf}
          />
        );

      default:
        return (
          <div className={styles.viewerOther}>
            <div className={styles.viewerOtherIcon}>{fileIcon(item)}</div>
            <p className={styles.viewerOtherName}>{item.name}</p>
            <p className={styles.viewerOtherMeta}>{item.mimeType || 'Unknown type'} · {formatSize(item.size)}</p>
            <a
              href={fileUrl}
              download={item.originalName || item.name}
              className={styles.viewerDownloadBtn}
            >
              <DownloadIcon /> Download file
            </a>
          </div>
        );
    }
  };

  return (
    <div className={styles.viewerOverlay} onClick={onClose}>
      {/* Header bar */}
      <div className={styles.viewerHeader} onClick={(e) => e.stopPropagation()}>
        <div className={styles.viewerTitle}>
          <span className={styles.viewerTitleIcon}>{fileIcon(item)}</span>
          <span className={styles.viewerTitleText}>{item.name}</span>
          {item.source === 'task' && item.task && (
            <button
              className={styles.viewerTaskBtn}
              onClick={() => onViewTask(item)}
              title={`Open task: ${item.task.title}`}
            >
              <CheckSquare size={11} strokeWidth={2.5} />
              {item.task.title}
            </button>
          )}
        </div>

        <div className={styles.viewerHeaderActions}>
          <a
            href={fileUrl}
            download={item.originalName || item.name}
            className={styles.viewerActionBtn}
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <DownloadIcon />
          </a>
          <button className={styles.viewerCloseBtn} onClick={onClose} title="Close (Esc)">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.viewerContent} onClick={(e) => e.stopPropagation()}>
        {renderContent()}
      </div>

      {/* Prev / Next nav */}
      {items.length > 1 && (
        <>
          <button
            className={`${styles.viewerNav} ${styles.viewerNavPrev}`}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ display: idx > 0 ? undefined : 'none' }}
            title="Previous"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <button
            className={`${styles.viewerNav} ${styles.viewerNavNext}`}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ display: idx < items.length - 1 ? undefined : 'none' }}
            title="Next"
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
        </>
      )}

      {/* Meta footer */}
      <div className={styles.viewerFooter} onClick={(e) => e.stopPropagation()}>
        <span>{formatSize(item.size)}</span>
        <span>·</span>
        <span>{formatDate(item.createdAt)}</span>
        {item.uploadedBy && <><span>·</span><span>by {item.uploadedBy.name}</span></>}
      </div>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function MediaLibrary({ projectId }: Props) {
  const user = useAuthStore((s) => s.user);
  const { members } = useTeam();
  const { patchTimer } = useTasks();

  /* State */
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'document' | 'archive' | 'other'>('all');
  const [sort, setSort] = useState<'date' | 'name' | 'size'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [uploading, setUploading] = useState(false);
  const [renameItem, setRenameItem] = useState<MediaItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /* File viewer */
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  /* Task popup */
  const [taskModalTask, setTaskModalTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Data loading ─────────────────────────────────────────────────── */

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get<MediaItem[]>(`/projects/${projectId}/media`);
      setItems(data);
    } catch {
      setError('Failed to load media. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  /* ── Derived / filtered items ─────────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }

    if (filter !== 'all') {
      result = result.filter((i) => i.fileType === filter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sort === 'date') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sort === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sort === 'size') {
        cmp = (a.size ?? 0) - (b.size ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [items, search, filter, sort, sortDir]);

  /* ── Upload handler ───────────────────────────────────────────────── */

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setError('');
      try {
        for (const file of Array.from(files)) {
          const body = new FormData();
          body.append('file', file);
          await api.post(`/projects/${projectId}/media`, body, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        await loadMedia();
      } catch {
        setError('Upload failed. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [projectId, loadMedia]
  );

  /* ── Rename handler ───────────────────────────────────────────────── */

  const handleRename = useCallback(async () => {
    if (!renameItem) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      const { data } = await api.patch<MediaItem>(
        `/projects/${projectId}/media/${renameItem._id}`,
        { name: trimmed }
      );
      setItems((prev) =>
        prev.map((i) => (i._id === renameItem._id ? { ...i, name: data.name } : i))
      );
      setRenameItem(null);
    } catch {
      setError('Rename failed. Please try again.');
    }
  }, [renameItem, renameValue, projectId]);

  /* ── Delete handler ───────────────────────────────────────────────── */

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${projectId}/media/${deleteTarget._id}`);
      setItems((prev) => prev.filter((i) => i._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch {
      setError('Delete failed. Please try again.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, projectId]);

  /* ── Open task modal from file viewer ────────────────────────────── */

  const handleViewTask = useCallback(async (item: MediaItem) => {
    if (!item.task?.id) return;
    setPreviewItem(null);
    setTaskLoading(true);
    try {
      const { data } = await api.get<Task>(`/tasks/${item.task.id}`);
      setTaskModalTask(data);
      setShowTaskModal(true);
    } catch {
      setError('Failed to load task.');
    } finally {
      setTaskLoading(false);
    }
  }, []);

  /* ── Sort select helper ───────────────────────────────────────────── */

  const sortValue = `${sort}-${sortDir}`;

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [s, d] = e.target.value.split('-') as ['date' | 'name' | 'size', 'desc' | 'asc'];
    setSort(s);
    setSortDir(d);
  };

  /* ── Drag events ──────────────────────────────────────────────────── */

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  };

  /* ── Open rename/delete modal ─────────────────────────────────────── */

  const openRename = (item: MediaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameItem(item);
    setRenameValue(item.name);
  };

  const openDelete = (item: MediaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(item);
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  const userId = user?.id;
  const userRole = user?.role;

  return (
    <>
      <div
        className={`${styles.root} ${isDragging ? styles.dropZoneActive : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className={styles.hiddenInput}
          onChange={(e) => {
            if (e.target.files) { handleUpload(e.target.files); e.target.value = ''; }
          }}
        />

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filterTabs}>
            {(['all', 'image', 'document', 'archive'] as const).map((f) => (
              <button
                key={f}
                className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'image' ? 'Images' : f === 'document' ? 'Documents' : 'Archives'}
              </button>
            ))}
          </div>

          <select className={styles.sortSelect} value={sortValue} onChange={handleSortChange}>
            <option value="date-desc">Newest</option>
            <option value="date-asc">Oldest</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="size-desc">Largest</option>
            <option value="size-asc">Smallest</option>
          </select>

          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`} onClick={() => setView('grid')} title="Grid view"><GridIcon /></button>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')} title="List view"><ListIcon /></button>
          </div>

          <button
            className={`${styles.uploadBtn} ${uploading ? styles.uploadBtnDisabled : ''}`}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        {isDragging && (
          <div className={`${styles.dropZone} ${styles.dropZoneActive}`}>
            <p className={styles.dropZoneText}>Drop files here to upload</p>
          </div>
        )}

        {error && <p className={styles.errorMsg}>{error}</p>}
        {(loading || taskLoading) && <div className={styles.loading}><Spinner /></div>}

        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            {items.length === 0 ? 'No files yet. Upload or drag files here.' : 'No files match your search or filter.'}
          </div>
        )}

        {/* ── Grid view ───────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && view === 'grid' && (
          <div className={styles.grid}>
            {filtered.map((item) => (
              <div key={item._id} className={styles.card} onClick={() => setPreviewItem(item)}>
                <div className={styles.cardThumb}>
                  {item.fileType === 'image' ? (
                    <img src={`${STATIC_BASE}${item.url}`} alt={item.name} loading="lazy" />
                  ) : mediaKind(item) === 'video' ? (
                    <div className={styles.cardVideoThumb}>
                      <span className={styles.cardIcon}>🎬</span>
                      <span className={styles.cardPlayBadge}>▶</span>
                    </div>
                  ) : (
                    <span className={styles.cardIcon}>{fileIcon(item)}</span>
                  )}
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardName} title={item.name}>{item.name}</div>
                  <div className={styles.cardMeta}>{formatSize(item.size)} · {formatDate(item.createdAt)}</div>
                  {item.source === 'task' && item.task && (
                    <button
                      className={styles.cardTaskBadge}
                      title={`Task: ${item.task.title}`}
                      onClick={(e) => { e.stopPropagation(); handleViewTask(item); }}
                    >
                      <CheckSquare size={9} strokeWidth={2.5} />
                      {item.task.title}
                    </button>
                  )}
                  {item.source === 'thumbnail' && (
                    <span className={styles.cardThumbBadge}>
                      <Image size={9} strokeWidth={2.5} />
                      Cover
                    </span>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <a
                    href={`${STATIC_BASE}${item.url}`}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className={styles.iconBtn}
                    title="Download"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DownloadIcon />
                  </a>
                  {canEdit(item, userId, userRole) && (
                    <button className={styles.iconBtn} title="Rename" onClick={(e) => openRename(item, e)}>
                      <PencilIcon />
                    </button>
                  )}
                  {canDelete(item, userId, userRole) && (
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Delete" onClick={(e) => openDelete(item, e)}>
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── List view ───────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && view === 'list' && (
          <div className={styles.list}>
            {filtered.map((item) => (
              <div key={item._id} className={styles.listRow} onClick={() => setPreviewItem(item)} style={{ cursor: 'pointer' }}>
                {item.fileType === 'image' ? (
                  <img src={`${STATIC_BASE}${item.url}`} alt={item.name} className={styles.listThumb} loading="lazy" />
                ) : (
                  <div className={styles.listIcon}>{fileIcon(item)}</div>
                )}

                <div className={styles.listName} title={item.name}>{item.name}</div>

                {item.source === 'task' && item.task && (
                  <button
                    className={styles.listTaskBadge}
                    title={`Task: ${item.task.title}`}
                    onClick={(e) => { e.stopPropagation(); handleViewTask(item); }}
                  >
                    <CheckSquare size={9} strokeWidth={2.5} />
                    {item.task.title}
                  </button>
                )}
                {item.source === 'thumbnail' && (
                  <span className={styles.listThumbBadge}>
                    <Image size={9} strokeWidth={2.5} />
                    Cover
                  </span>
                )}

                <div className={styles.listMeta}>
                  {formatSize(item.size)} · {formatDate(item.createdAt)}
                  {item.uploadedBy?.name ? ` · ${item.uploadedBy.name}` : ''}
                </div>

                <div className={styles.listActions}>
                  <a
                    href={`${STATIC_BASE}${item.url}`}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className={styles.listIconBtn}
                    title="Download"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DownloadIcon />
                  </a>
                  {canEdit(item, userId, userRole) && (
                    <button className={styles.listIconBtn} title="Rename" onClick={(e) => openRename(item, e)}>
                      <PencilIcon />
                    </button>
                  )}
                  {canDelete(item, userId, userRole) && (
                    <button className={`${styles.listIconBtn} ${styles.listIconBtnDanger}`} title="Delete" onClick={(e) => openDelete(item, e)}>
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Rename Modal ────────────────────────────────────────────── */}
        <Modal isOpen={renameItem !== null} onClose={() => setRenameItem(null)} title="Rename File" size="sm">
          <div className={styles.renameModal}>
            <input
              type="text"
              className={styles.renameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
              autoFocus
              placeholder="File name"
            />
            <div className={styles.modalActions}>
              <Button variant="secondary" size="sm" onClick={() => setRenameItem(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleRename} disabled={!renameValue.trim()}>Save</Button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Confirm Modal ─────────────────────────────────────── */}
        <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete File" size="sm">
          <p className={styles.confirmMsg}>Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
          <div className={styles.modalActions}>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>Delete</Button>
          </div>
        </Modal>
      </div>

      {/* ── File Viewer Overlay ──────────────────────────────────────── */}
      {previewItem && (
        <FileViewer
          item={previewItem}
          items={filtered}
          onClose={() => setPreviewItem(null)}
          onViewTask={handleViewTask}
        />
      )}

      {/* ── Task Modal ───────────────────────────────────────────────── */}
      <TaskModal
        task={taskModalTask}
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setTaskModalTask(null); }}
        onUpdate={(updated) => setTaskModalTask(updated)}
        members={members}
        patchTimer={patchTimer}
      />
    </>
  );
}
