'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Avatar from '@/components/ui/Avatar/Avatar';
import Badge from '@/components/ui/Badge/Badge';
import Modal from '@/components/ui/Modal/Modal';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { useDepartments } from '@/hooks/useDepartments';
import { usePushSubscription, type PushStatus } from '@/hooks/usePushSubscription';
import api from '@/lib/api';
import styles from './settings.module.css';
import { Eye, EyeOff, Camera, Loader, ChevronRight } from 'lucide-react';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
);

const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

/* ── Eye icon ────────────────────────────────────────────────────────── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? <Eye size={16} /> : <EyeOff size={16} />;
}

/* ── Password field with eye toggle ─────────────────────────────────── */
function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <div className={styles.passwordWrap}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={styles.passwordInput}
        />
        <button
          type="button"
          className={styles.eyeBtn}
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

/* ── Success popup ───────────────────────────────────────────────────── */
function SuccessPopup({ message, onClose }: { message: string; onClose: () => void }) {
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
        <h3 className={styles.successTitle}>Done!</h3>
        <p className={styles.successMsg}>{message}</p>
        <Button onClick={onClose} size="sm">Close</Button>
      </div>
    </div>
  );
}

/* ── Confirm dialog ──────────────────────────────────────────────────── */
function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <Modal isOpen onClose={onCancel} title="Confirm" size="sm">
      <p className={styles.confirmText}>{message}</p>
      <div className={styles.confirmActions}>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button onClick={onConfirm} loading={loading}>Yes, save</Button>
      </div>
    </Modal>
  );
}

/* ── Push Status Card ────────────────────────────────────────────────── */
const PUSH_META: Record<PushStatus, { dot: string; label: string; desc: string }> = {
  loading:        { dot: '#8888A0', label: 'Checking…',          desc: 'Detecting push notification subscription status.' },
  unsupported:    { dot: '#8888A0', label: 'Not supported',      desc: 'Your browser does not support Web Push notifications.' },
  denied:         { dot: '#FF4757', label: 'Blocked',            desc: 'You blocked notifications for this site. Open browser site settings to allow them, then re-enable here.' },
  not_granted:    { dot: '#FFD32A', label: 'Not enabled',        desc: 'Push notifications have not been set up yet. Click Enable to subscribe this device.' },
  not_subscribed: { dot: '#FFD32A', label: 'Not subscribed',     desc: 'Permission is granted but no active subscription on this device. Click Enable to subscribe.' },
  subscribed:     { dot: '#00D4AA', label: 'Active',             desc: 'Push notifications are active on this device. Toggle to pause delivery.' },
  paused:         { dot: '#8888A0', label: 'Paused',             desc: 'Notifications are paused on this device. Toggle to resume.' },
  sw_unavailable: { dot: '#FF4757', label: 'Service worker off', desc: 'Push requires a production build with an active service worker. Run the app in production mode (npm run build && npm start).' },
};

function PushStatusCard({
  status, loading, onEnable, onDisable, onReset,
}: {
  status: PushStatus;
  loading: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onReset: () => void;
}) {
  const meta = PUSH_META[status];
  const isOn = status === 'subscribed';
  const isPaused = status === 'paused';
  const canToggle = isOn || isPaused;
  const showReset = canToggle;

  return (
    <div className={styles.notifMasterWrapper}>
      <div className={styles.notifMaster}>
        <div className={styles.notifMasterInfo}>
          <div className={styles.notifMasterLabelRow}>
            <span
              className={styles.pushDot}
              style={{ background: meta.dot, animation: status === 'loading' ? 'pulse 1.5s infinite' : 'none' }}
            />
            <span className={styles.notifMasterLabel}>Push Notifications — <span style={{ color: meta.dot }}>{meta.label}</span></span>
          </div>
          <span className={styles.notifMasterDesc}>{meta.desc}</span>
          {status === 'denied' && (
            <a
              href="https://support.google.com/chrome/answer/3220216"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.pushHelpLink}
            >
              How to unblock notifications ↗
            </a>
          )}
        </div>

        {(status === 'not_granted' || status === 'not_subscribed') && (
          <button
            type="button"
            className={styles.pushEnableBtn}
            onClick={onEnable}
            disabled={loading}
          >
            {loading ? 'Enabling…' : 'Enable'}
          </button>
        )}

        {canToggle && (
          <button
            type="button"
            className={`${styles.pillToggle} ${isOn ? styles.pillToggleOn : ''}`}
            onClick={isOn ? onDisable : onEnable}
            disabled={loading}
            role="switch"
            aria-checked={isOn}
            title={isOn ? 'Pause notifications on this device' : 'Resume notifications on this device'}
          >
            <span className={styles.pillThumb} />
          </button>
        )}

        {(status === 'unsupported' || status === 'denied' || status === 'loading' || status === 'sw_unavailable') && (
          <button
            type="button"
            className={styles.pillToggle}
            disabled
            role="switch"
            aria-checked={false}
          >
            <span className={styles.pillThumb} />
          </button>
        )}
      </div>

      {showReset && (
        <div className={styles.pushResetRow}>
          <button
            type="button"
            className={styles.pushResetBtn}
            onClick={onReset}
            disabled={loading}
            title="Fully remove this device's push subscription"
          >
            Reset subscription
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const updateUser = useAuthStore((s) => s.updateUser);
  const { departments } = useDepartments();

  /* Profile */
  const [name, setName] = useState(user?.name || '');
  const [profileError, setProfileError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Password */
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');

  /* Shared UI state */
  const [confirmState, setConfirmState] = useState<{
    message: string;
    action: () => Promise<void>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const avatarSrc = user?.avatar ? `${user.avatar}` : undefined;

  /* ── Departments ─────────────────────────────────────────────────── */
  const myDepartments = useMemo(
    () => departments.filter((d) => d.members.some((m) => m.id === user?.id || (m as any)._id === user?.id)),
    [departments, user?.id]
  );

  /* ── Avatar upload (no confirm — instant) ─────────────────────────── */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setProfileError('');
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await api.post('/auth/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ avatar: data.avatar });
      setSuccessMessage('Profile picture updated.');
    } catch {
      setProfileError('Failed to upload picture.');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── Save profile name ───────────────────────────────────────────── */
  const requestSaveProfile = () => {
    if (!name.trim()) { setProfileError('Name cannot be empty.'); return; }
    setProfileError('');
    setConfirmState({
      message: 'Save profile changes?',
      action: async () => {
        const { data } = await api.put('/auth/me', { name: name.trim() });
        updateUser({ name: data.name });
        setSuccessMessage('Profile updated successfully.');
      },
    });
  };

  /* ── Change password ─────────────────────────────────────────────── */
  const requestChangePassword = () => {
    setPwError('');
    if (!newPassword || !confirmPassword) {
      setPwError('Both fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    setConfirmState({
      message: 'Change your password?',
      action: async () => {
        await api.put('/auth/me/password', { newPassword });
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage('Password changed successfully.');
      },
    });
  };

  /* ── Run confirmed action ────────────────────────────────────────── */
  const handleConfirm = async () => {
    if (!confirmState) return;
    setConfirming(true);
    try {
      await confirmState.action();
      setConfirmState(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Something went wrong.';
      // Route error back to the right field
      if (msg.toLowerCase().includes('password')) {
        setPwError(msg);
      } else {
        setProfileError(msg);
      }
      setConfirmState(null);
    } finally {
      setConfirming(false);
    }
  };

  /* ── Push notification status ───────────────────────────────────── */
  const { status: pushStatus, loading: pushLoading, enable: enablePush, disable: disablePush, reset: resetPush } = usePushSubscription();

  /* ─────────────────────────────────────────────────────────────────── */

  return (
    <AppShell title="Settings">
      <div className={styles.page}>

        {/* ── Profile ─────────────────────────────────────────────────── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile</h2>
          <div className={styles.profile}>
            <button
              className={styles.avatarBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              title="Change profile picture"
            >
              <Avatar name={name || 'U'} src={avatarSrc} size="lg" />
              <span className={styles.avatarOverlay}>
                {avatarUploading ? (
                  <Loader size={18} strokeWidth={2.5} className={styles.spin} />
                ) : (
                  <Camera size={18} strokeWidth={2.5} />
                )}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={styles.hiddenInput}
              onChange={handleAvatarChange}
            />
            <div className={styles.profileInfo}>
              <h3>{user?.name}</h3>
              <p>{user?.email}</p>
              <Badge variant="primary">{user?.role}</Badge>
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.field}>
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setProfileError(''); }}
                placeholder="Your full name"
              />
            </div>
            <div className={styles.field}>
              <label>Email</label>
              <input value={user?.email || ''} disabled />
            </div>
            <div className={styles.field}>
              <label>Role</label>
              <input value={user?.role || ''} disabled />
            </div>

            {profileError && <p className={styles.error}>{profileError}</p>}

            <Button onClick={requestSaveProfile}>Save Changes</Button>
          </div>

          {/* Departments */}
          <div className={styles.deptSection}>
            <div className={styles.deptSectionHeader}>
              <span className={styles.deptSectionTitle}>Departments</span>
              <Link href="/departments" className={styles.deptManageLink}>
                Manage
                <ChevronRight size={11} strokeWidth={2.5} />
              </Link>
            </div>
            {myDepartments.length === 0 ? (
              <p className={styles.deptEmpty}>You are not part of any department yet.</p>
            ) : (
              <div className={styles.deptChips}>
                {myDepartments.map((d) => {
                  const isHead = d.heads?.some((h) => (h as any)?.id === user?.id || (h as any)?._id === user?.id) ?? false;
                  return (
                    <Link key={d._id} href="/departments" className={styles.deptChip} style={{ '--dept-color': d.color } as React.CSSProperties}>
                      <span className={styles.deptDot} style={{ background: d.color }} />
                      <span className={styles.deptChipName}>{d.name}</span>
                      {isHead && <span className={styles.deptHeadBadge}>Head</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Change Password ──────────────────────────────────────────── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Change Password</h2>
          <div className={styles.form}>
            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={(v) => { setNewPassword(v); setPwError(''); }}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(v) => { setConfirmPassword(v); setPwError(''); }}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />

            {pwError && <p className={styles.error}>{pwError}</p>}

            <Button onClick={requestChangePassword}>Update Password</Button>
          </div>
        </div>

        {/* ── Notifications ────────────────────────────────────────────── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Notifications</h2>
          <PushStatusCard
            status={pushStatus}
            loading={pushLoading}
            onEnable={enablePush}
            onDisable={disablePush}
            onReset={resetPush}
          />
        </div>

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <div className={styles.dangerZone}>
          <h2 className={styles.sectionTitle}>Danger Zone</h2>
          <Button variant="danger" onClick={logout}>Sign Out</Button>
        </div>
      </div>

      {/* ── Confirm dialog ───────────────────────────────────────────── */}
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
          loading={confirming}
        />
      )}

      {/* ── Success popup ────────────────────────────────────────────── */}
      {successMessage && (
        <SuccessPopup
          message={successMessage}
          onClose={() => setSuccessMessage('')}
        />
      )}
    </AppShell>
  );
}
