'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Spinner from '@/components/ui/Spinner/Spinner';
import api from '@/lib/api';
import styles from './SocialTab.module.css';
import { Link, Upload, Image, Check, Clock, Pencil } from 'lucide-react';

const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

type Platform = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'gmb' | 'pinterest' | 'threads';
type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
type FilterStatus = 'all' | PostStatus;
type MediaMode = 'url' | 'upload' | 'gallery';

interface SocialAccount {
  _id: string;
  platform: Platform;
  accountName: string;
  accessToken: string;
  igUserId?: string;
  pageId?: string;
  channelId?: string;
  authorUrn?: string;
  accountId?: string;
  locationId?: string;
  boardId?: string;
  userId?: string;
}

interface SocialPost {
  _id: string;
  platform: Platform;
  account: { _id: string; accountName: string; platform: Platform };
  caption: string;
  hashtags: string;
  mediaUrl: string;
  scheduledAt: string;
  status: PostStatus;
  errorMessage?: string;
  platformPostId?: string;
  createdAt: string;
}

interface GalleryItem {
  _id: string;
  name: string;
  url: string;
  mimeType: string;
  fileType: 'image' | 'document' | 'archive' | 'other';
  size?: number;
}

interface PlatformMeta {
  id: Platform;
  label: string;
  color: string;
  icon: string;
  charLimit: number;
  fields: { key: string; label: string; placeholder: string; required?: boolean }[];
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: 'instagram', label: 'Instagram', color: '#E1306C', icon: 'IG', charLimit: 2200,
    fields: [{ key: 'igUserId', label: 'Instagram User ID', placeholder: '17841400000000000', required: true }],
  },
  {
    id: 'facebook', label: 'Facebook', color: '#1877F2', icon: 'FB', charLimit: 63206,
    fields: [{ key: 'pageId', label: 'Page ID', placeholder: '100000000000000', required: true }],
  },
  {
    id: 'youtube', label: 'YouTube', color: '#FF0000', icon: 'YT', charLimit: 5000,
    fields: [{ key: 'channelId', label: 'Channel ID', placeholder: 'UCxxxxxxxxxxxxxxxxx', required: true }],
  },
  {
    id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', icon: 'LI', charLimit: 3000,
    fields: [{ key: 'authorUrn', label: 'Author URN', placeholder: 'urn:li:person:xxxxx  or  urn:li:organization:12345', required: true }],
  },
  {
    id: 'gmb', label: 'GMB', color: '#4285F4', icon: 'G', charLimit: 1500,
    fields: [
      { key: 'accountId', label: 'GMB Account ID', placeholder: 'accounts/123456789', required: true },
      { key: 'locationId', label: 'Location ID', placeholder: 'locations/987654321', required: true },
    ],
  },
  {
    id: 'pinterest', label: 'Pinterest', color: '#E60023', icon: 'PI', charLimit: 500,
    fields: [{ key: 'boardId', label: 'Board ID', placeholder: '123456789012345678', required: true }],
  },
  {
    id: 'threads', label: 'Threads', color: '#8B5CF6', icon: 'TH', charLimit: 500,
    fields: [{ key: 'userId', label: 'Threads User ID', placeholder: '17841400000000000', required: true }],
  },
];

const STATUS_COLOR: Record<PostStatus, string> = {
  draft: '#8888A0',
  scheduled: '#FFD32A',
  publishing: '#6C63FF',
  published: '#00D4AA',
  failed: '#FF4757',
};

function fmt(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Media Picker ──────────────────────────────────────────────────────────────

function MediaPicker({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [mode, setMode] = useState<MediaMode>('url');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadGallery = useCallback(async () => {
    if (galleryLoaded) return;
    setGalleryLoading(true);
    try {
      const { data } = await api.get<GalleryItem[]>(`/projects/${projectId}/media`);
      setGallery(data.filter((i) => i.fileType === 'image' || i.mimeType?.startsWith('image/') || i.mimeType?.startsWith('video/')));
      setGalleryLoaded(true);
    } catch { /* silent */ }
    setGalleryLoading(false);
  }, [projectId, galleryLoaded]);

  const switchMode = (m: MediaMode) => {
    setMode(m);
    if (m === 'gallery') loadGallery();
  };

  const handleUpload = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/projects/${projectId}/media`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fullUrl = `${STATIC_BASE}${data.url}`;
      onChange(fullUrl);
      // refresh gallery cache
      setGalleryLoaded(false);
    } catch {
      setUploadError('Upload failed. Max 1 GB, images/video only.');
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  };

  const isSelected = (item: GalleryItem) => value === `${STATIC_BASE}${item.url}`;

  return (
    <div className={styles.mediaPicker}>
      {/* Mode tabs */}
      <div className={styles.mediaModeTabs}>
        {(['url', 'upload', 'gallery'] as MediaMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`${styles.mediaModeTab} ${mode === m ? styles.mediaModeTabActive : ''}`}
            onClick={() => switchMode(m)}
          >
            {m === 'url' && (
  <><Link size={12} strokeWidth={2.5} /> URL</>
            )}
            {m === 'upload' && (
  <><Upload size={12} strokeWidth={2.5} /> Upload</>
            )}
            {m === 'gallery' && (
  <><Image size={12} strokeWidth={2.5} /> Gallery</>
            )}
          </button>
        ))}
        {value && (
          <button
            type="button"
            className={styles.mediaClearBtn}
            onClick={() => onChange('')}
            title="Remove media"
          >
            ✕ Remove
          </button>
        )}
      </div>

      {/* URL mode */}
      {mode === 'url' && (
        <div className={styles.mediaUrlWrap}>
          <input
            className={styles.mediaUrlInput}
            placeholder="https://example.com/image.jpg"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className={styles.mediaUploadWrap}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className={styles.hiddenInput}
            onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = ''; }}
          />
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''} ${uploading ? styles.dropZoneUploading : ''}`}
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <>
                <Spinner size="sm" />
                <span className={styles.dropZoneText}>Uploading…</span>
              </>
            ) : (
              <>
                <Upload size={22} strokeWidth={1.5} className={styles.dropZoneIcon} />
                <span className={styles.dropZoneText}><u>Click to browse</u> or drag &amp; drop</span>
                <span className={styles.dropZoneSub}>Images &amp; videos — max 1 GB</span>
              </>
            )}
          </div>
          {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
        </div>
      )}

      {/* Gallery mode */}
      {mode === 'gallery' && (
        <div className={styles.galleryWrap}>
          {galleryLoading && <div className={styles.galleryLoading}><Spinner size="sm" /></div>}
          {!galleryLoading && gallery.length === 0 && (
            <p className={styles.galleryEmpty}>No images in this project's media library yet.</p>
          )}
          {!galleryLoading && gallery.length > 0 && (
            <div className={styles.galleryGrid}>
              {gallery.map((item) => {
                const selected = isSelected(item);
                return (
                  <button
                    key={item._id}
                    type="button"
                    className={`${styles.galleryItem} ${selected ? styles.galleryItemSelected : ''}`}
                    onClick={() => onChange(selected ? '' : `${STATIC_BASE}${item.url}`)}
                    title={item.name}
                  >
                    <img
                      src={`${STATIC_BASE}${item.url}`}
                      alt={item.name}
                      className={styles.galleryImg}
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                    {selected && (
                      <span className={styles.galleryCheckmark}>
                        <Check size={14} strokeWidth={3} stroke="#fff" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Preview strip (always shown when value is set) */}
      {value && (
        <div className={styles.mediaPreviewStrip}>
          <img
            src={value}
            alt="Preview"
            className={styles.mediaPreviewImg}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SocialTab({ projectId }: { projectId: string }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const [connectPlatform, setConnectPlatform] = useState<Platform>('instagram');
  const [connectFields, setConnectFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [composeAccountId, setComposeAccountId] = useState('');
  const [composeCaption, setComposeCaption] = useState('');
  const [composeHashtags, setComposeHashtags] = useState('');
  const [composeMedia, setComposeMedia] = useState('');
  const [composeScheduledAt, setComposeScheduledAt] = useState('');
  const [composeStatus, setComposeStatus] = useState<'draft' | 'scheduled'>('scheduled');
  const [composeSaving, setComposeSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: accs }, { data: ps }] = await Promise.all([
        api.get(`/projects/${projectId}/social/accounts`),
        api.get(`/projects/${projectId}/social/posts`),
      ]);
      setAccounts(accs);
      setPosts(ps);
      if (!activePlatform && accs.length > 0) setActivePlatform(accs[0].platform);
    } catch { /* silent */ }
    setLoading(false);
  }, [projectId, activePlatform]);

  useEffect(() => { load(); }, [projectId]);

  const connectedPlatformIds = Array.from(new Set(accounts.map((a) => a.platform)));
  const activeMeta = PLATFORMS.find((p) => p.id === activePlatform);
  const activeAccount = accounts.find((a) => a.platform === activePlatform);

  const platformPosts = posts.filter((p) => p.platform === activePlatform);
  const visiblePosts = filterStatus === 'all' ? platformPosts : platformPosts.filter((p) => p.status === filterStatus);

  // ── Connect Platform ──────────────────────────────────────────────────────

  const openConnect = (platform?: Platform) => {
    const p = platform || 'instagram';
    setConnectPlatform(p);
    const existing = accounts.find((a) => a.platform === p);
    // Spread existing last so platform-specific IDs are pre-filled,
    // but always reset accessToken to empty so the masked value is never re-sent.
    setConnectFields({ ...(existing || {}), accountName: existing?.accountName || '', accessToken: '' });
    setShowConnectModal(true);
  };

  const handleConnect = async () => {
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/social/accounts`, {
        platform: connectPlatform,
        ...connectFields,
      });
      await load();
      setActivePlatform(connectPlatform);
      setShowConnectModal(false);
      setConnectFields({});
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Remove this platform account and all its posts?')) return;
    await api.delete(`/projects/${projectId}/social/accounts/${accountId}`);
    await load();
    if (activePlatform === accounts.find((a) => a._id === accountId)?.platform) {
      setActivePlatform(accounts.find((a) => a._id !== accountId)?.platform ?? null);
    }
  };

  // ── Compose / Edit Post ───────────────────────────────────────────────────

  const resetCompose = () => {
    setComposeCaption('');
    setComposeHashtags('');
    setComposeMedia('');
    setComposeScheduledAt('');
    setComposeStatus('scheduled');
    setEditingPost(null);
    if (activeAccount) setComposeAccountId(activeAccount._id);
  };

  const openCompose = () => {
    resetCompose();
    if (activeAccount) setComposeAccountId(activeAccount._id);
    setShowComposeModal(true);
  };

  const openEdit = (post: SocialPost) => {
    setEditingPost(post);
    setComposeAccountId(post.account._id);
    setComposeCaption(post.caption);
    setComposeHashtags(post.hashtags);
    setComposeMedia(post.mediaUrl);
    setComposeScheduledAt(post.scheduledAt ? post.scheduledAt.slice(0, 16) : '');
    setComposeStatus(post.status === 'draft' ? 'draft' : 'scheduled');
    setShowComposeModal(true);
  };

  const handleSavePost = async () => {
    setComposeSaving(true);
    try {
      const payload = {
        accountId: composeAccountId,
        platform: activePlatform,
        caption: composeCaption,
        hashtags: composeHashtags,
        mediaUrl: composeMedia,
        scheduledAt: composeScheduledAt,
        status: composeStatus,
      };
      if (editingPost) {
        await api.put(`/projects/${projectId}/social/posts/${editingPost._id}`, payload);
      } else {
        await api.post(`/projects/${projectId}/social/posts`, payload);
      }
      await load();
      setShowComposeModal(false);
      resetCompose();
    } catch { /* silent */ }
    setComposeSaving(false);
  };

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId);
    await api.delete(`/projects/${projectId}/social/posts/${postId}`);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    setDeletingPostId(null);
  };

  const handlePublishNow = async (postId: string) => {
    setPublishing(postId);
    try {
      const { data } = await api.post(`/projects/${projectId}/social/posts/${postId}/publish-now`);
      setPosts((prev) => prev.map((p) => (p._id === postId ? data : p)));
    } catch { /* silent */ }
    setPublishing(null);
  };

  const connectMeta = PLATFORMS.find((p) => p.id === connectPlatform)!;
  const charLimit = activeMeta?.charLimit ?? 2200;

  if (loading) {
    return <div className={styles.loading}><Spinner size="lg" /></div>;
  }

  return (
    <div className={styles.wrap}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>Social Media Scheduler</h3>
          <p className={styles.subtitle}>{connectedPlatformIds.length} platform{connectedPlatformIds.length !== 1 ? 's' : ''} connected</p>
        </div>
        <div className={styles.headerRight}>
          <Button variant="secondary" size="sm" onClick={() => openConnect()}>+ Connect Platform</Button>
          {activePlatform && activeAccount && (
            <Button size="sm" onClick={openCompose}>+ Schedule Post</Button>
          )}
        </div>
      </div>

      {connectedPlatformIds.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📱</span>
          <p className={styles.emptyTitle}>No platforms connected</p>
          <p className={styles.emptyText}>Connect your social media accounts and paste their API tokens to start scheduling posts automatically.</p>
          <Button onClick={() => openConnect()}>Connect First Platform</Button>
        </div>
      ) : (
        <>
          {/* ── Platform tabs ── */}
          <div className={styles.platformBar}>
            {connectedPlatformIds.map((pid) => {
              const meta = PLATFORMS.find((p) => p.id === pid)!;
              const pending = posts.filter((p) => p.platform === pid && p.status === 'scheduled').length;
              const acc = accounts.find((a) => a.platform === pid);
              return (
                <button
                  key={pid}
                  className={`${styles.platTab} ${activePlatform === pid ? styles.platTabActive : ''}`}
                  style={activePlatform === pid ? { '--pc': meta.color } as React.CSSProperties : undefined}
                  onClick={() => { setActivePlatform(pid); setFilterStatus('all'); }}
                >
                  <span className={styles.platIcon} style={{ background: meta.color }}>{meta.icon}</span>
                  <span className={styles.platLabel}>{meta.label}</span>
                  {acc && <span className={styles.platAccount}>{acc.accountName}</span>}
                  {pending > 0 && <span className={styles.platCount}>{pending}</span>}
                </button>
              );
            })}
            <button className={styles.addPlatBtn} onClick={() => openConnect()} title="Connect another platform">+</button>
          </div>

          {/* ── Active platform info row ── */}
          {activeAccount && activeMeta && (
            <div className={styles.platformInfo}>
              <span className={styles.platIcon} style={{ background: activeMeta.color, width: 28, height: 28 }}>{activeMeta.icon}</span>
              <div>
                <span className={styles.platformInfoName}>{activeMeta.label}</span>
                <span className={styles.platformInfoAcc}>{activeAccount.accountName}</span>
              </div>
              <div className={styles.platformInfoActions}>
                <button className={styles.editTokenBtn} onClick={() => openConnect(activePlatform!)}>
                  <Pencil size={13} />
                  Edit Token
                </button>
                <button className={styles.disconnectBtn} onClick={() => handleDisconnect(activeAccount._id)}>
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* ── Filter sub-tabs ── */}
          <div className={styles.filterBar}>
            {(['all', 'scheduled', 'published', 'draft', 'failed'] as FilterStatus[]).map((s) => {
              const cnt = s === 'all' ? platformPosts.length : platformPosts.filter((p) => p.status === s).length;
              return (
                <button
                  key={s}
                  className={`${styles.filterBtn} ${filterStatus === s ? styles.filterBtnActive : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  {cnt > 0 && <span className={styles.filterCnt}>{cnt}</span>}
                </button>
              );
            })}
          </div>

          {/* ── Posts ── */}
          {visiblePosts.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>✏️</span>
              <p className={styles.emptyTitle}>{filterStatus === 'all' ? 'No posts yet' : `No ${filterStatus} posts`}</p>
              <p className={styles.emptyText}>
                {activeMeta && `Click "+ Schedule Post" to create a post for ${activeMeta.label}.`}
              </p>
            </div>
          ) : (
            <div className={styles.postGrid}>
              {visiblePosts.map((post) => {
                const isPast = new Date(post.scheduledAt) < new Date();
                const isDeleting = deletingPostId === post._id;
                const isPublishing = publishing === post._id;
                return (
                  <div key={post._id} className={styles.postCard} style={{ '--pc': activeMeta?.color } as React.CSSProperties}>
                    <div className={styles.postTop}>
                      <div className={styles.postStatusRow}>
                        <span className={styles.statusDot} style={{ background: STATUS_COLOR[post.status] }} />
                        <span className={styles.statusLabel} style={{ color: STATUS_COLOR[post.status] }}>
                          {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                        </span>
                        {post.status === 'scheduled' && isPast && <span className={styles.overdueTag}>Overdue</span>}
                        {post.status === 'publishing' && <Spinner size="sm" />}
                      </div>
                      <div className={styles.postActions}>
                        {(post.status === 'scheduled' || post.status === 'failed') && (
                          <button className={styles.postBtn} title="Publish now" disabled={isPublishing} onClick={() => handlePublishNow(post._id)}>
                            {isPublishing ? '…' : '▶'}
                          </button>
                        )}
                        {post.status !== 'published' && post.status !== 'publishing' && (
                          <button className={styles.postBtn} title="Edit" onClick={() => openEdit(post)}>✏</button>
                        )}
                        <button className={`${styles.postBtn} ${styles.postBtnDanger}`} title="Delete" disabled={isDeleting} onClick={() => handleDeletePost(post._id)}>
                          {isDeleting ? '…' : '✕'}
                        </button>
                      </div>
                    </div>

                    {post.mediaUrl && (
                      <div className={styles.postMedia}>
                        <img src={post.mediaUrl} alt="" className={styles.postMediaImg}
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                      </div>
                    )}

                    <p className={styles.postCaption}>{post.caption}</p>
                    {post.hashtags && <p className={styles.postHashtags}>{post.hashtags}</p>}

                    {post.status === 'failed' && post.errorMessage && (
                      <div className={styles.errorBox}>
                        <span className={styles.errorLabel}>Error:</span> {post.errorMessage}
                      </div>
                    )}
                    {post.platformPostId && <div className={styles.postedId}>Post ID: {post.platformPostId}</div>}

                    <div className={styles.postMeta}>
                      <span className={styles.postTime}>
                        <Clock size={11} />
                        {fmt(post.scheduledAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Connect Platform Modal ── */}
      <Modal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} title="Connect Platform" size="md">
        <div className={styles.connectModal}>
          <div className={styles.field}>
            <label>Platform</label>
            <div className={styles.platformPicker}>
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.platformPickerBtn} ${connectPlatform === p.id ? styles.platformPickerBtnActive : ''}`}
                  style={connectPlatform === p.id ? { '--pc': p.color } as React.CSSProperties : undefined}
                  onClick={() => {
                    setConnectPlatform(p.id);
                    const existing = accounts.find((a) => a.platform === p.id);
                    setConnectFields({ ...(existing || {}), accountName: existing?.accountName || '', accessToken: '' });
                  }}
                >
                  <span className={styles.platIcon} style={{ background: p.color }}>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label>Account / Page Name <span className={styles.req}>*</span></label>
            <input placeholder="e.g. My Brand Instagram" value={connectFields.accountName || ''}
              onChange={(e) => setConnectFields((f) => ({ ...f, accountName: e.target.value }))} />
          </div>

          <div className={styles.field}>
            <label>Access Token <span className={styles.req}>*</span></label>
            <input type="password" placeholder="Paste your long-lived access token"
              value={connectFields.accessToken || ''}
              onChange={(e) => setConnectFields((f) => ({ ...f, accessToken: e.target.value }))}
              autoComplete="off" />
            <p className={styles.fieldHint}>
              {connectPlatform === 'instagram' && 'Get from Meta for Developers → Graph API Explorer. Select your Instagram Business account.'}
              {connectPlatform === 'facebook' && 'Get a Page Access Token from Meta for Developers → Graph API Explorer.'}
              {connectPlatform === 'youtube' && 'Use Google OAuth Playground to get a YouTube Data API v3 access token.'}
              {connectPlatform === 'linkedin' && 'Create a LinkedIn App, add w_member_social scope, use OAuth 2.0 to generate a token.'}
              {connectPlatform === 'gmb' && 'Use Google OAuth Playground with mybusiness.manage scope.'}
              {connectPlatform === 'pinterest' && 'Create a Pinterest App and generate an access token from the developer dashboard.'}
              {connectPlatform === 'threads' && 'Use the Threads API (Meta for Developers) — threads_basic + threads_content_publish scopes.'}
            </p>
          </div>

          {connectMeta.fields.map((field) => (
            <div key={field.key} className={styles.field}>
              <label>{field.label}{field.required && <span className={styles.req}> *</span>}</label>
              <input placeholder={field.placeholder} value={connectFields[field.key] || ''}
                onChange={(e) => setConnectFields((f) => ({ ...f, [field.key]: e.target.value }))} />
            </div>
          ))}

          <div className={styles.connectActions}>
            <Button variant="ghost" onClick={() => setShowConnectModal(false)}>Cancel</Button>
            <Button onClick={handleConnect} loading={saving}
              disabled={!connectFields.accountName || (!connectFields.accessToken && !accounts.find((a) => a.platform === connectPlatform))}>
              {accounts.find((a) => a.platform === connectPlatform) ? 'Update' : 'Connect'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Compose / Edit Post Modal ── */}
      <Modal
        isOpen={showComposeModal}
        onClose={() => { setShowComposeModal(false); resetCompose(); }}
        title={editingPost ? 'Edit Scheduled Post' : `Schedule Post — ${activeMeta?.label}`}
        size="md"
      >
        <div className={styles.composeModal}>
          {activeMeta && (
            <div className={styles.platformBanner} style={{ borderColor: activeMeta.color }}>
              <span className={styles.platIcon} style={{ background: activeMeta.color }}>{activeMeta.icon}</span>
              <span className={styles.platformBannerName}>{activeMeta.label}</span>
              <span className={styles.platformBannerLimit}>Max {activeMeta.charLimit.toLocaleString()} chars</span>
            </div>
          )}

          <div className={styles.field}>
            <label>Caption <span className={styles.req}>*</span></label>
            <textarea className={styles.captionArea} rows={5}
              placeholder="Write your caption…"
              value={composeCaption}
              onChange={(e) => setComposeCaption(e.target.value)}
              maxLength={charLimit}
              autoFocus
            />
            <div className={styles.charCount}
              style={{ color: composeCaption.length > charLimit * 0.9 ? '#FF4757' : 'var(--text-muted)' }}>
              {composeCaption.length} / {charLimit.toLocaleString()}
            </div>
          </div>

          <div className={styles.field}>
            <label>Hashtags</label>
            <input placeholder="#brand #marketing" value={composeHashtags}
              onChange={(e) => setComposeHashtags(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label>Media <span className={styles.optional}>(image or video)</span></label>
            <MediaPicker projectId={projectId} value={composeMedia} onChange={setComposeMedia} />
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Schedule Date &amp; Time <span className={styles.req}>*</span></label>
              <input type="datetime-local" value={composeScheduledAt}
                onChange={(e) => setComposeScheduledAt(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Save as</label>
              <select value={composeStatus}
                onChange={(e) => setComposeStatus(e.target.value as 'draft' | 'scheduled')}>
                <option value="scheduled">Scheduled (auto-post)</option>
                <option value="draft">Draft (won't auto-post)</option>
              </select>
            </div>
          </div>

          <div className={styles.composeActions}>
            <Button variant="ghost" onClick={() => { setShowComposeModal(false); resetCompose(); }}>Cancel</Button>
            <Button onClick={handleSavePost} loading={composeSaving}
              disabled={!composeCaption.trim() || !composeScheduledAt}>
              {editingPost ? 'Save Changes' : 'Schedule Post'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
