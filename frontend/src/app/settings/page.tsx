'use client';

import { useState, useMemo, useRef } from 'react';
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
import api from '@/lib/api';
import styles from './settings.module.css';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
);

const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

/* ── Eye icon ────────────────────────────────────────────────────────── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
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
  const [currentPassword, setCurrentPassword] = useState('');
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

  const avatarSrc = user?.avatar ? `${STATIC_BASE}${user.avatar}` : undefined;

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
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setConfirmState({
      message: 'Change your password?',
      action: async () => {
        await api.put('/auth/me/password', { currentPassword, newPassword });
        setCurrentPassword('');
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

  /* ── Notification prefs (local only for now) ─────────────────────── */
  const [notifPrefs, setNotifPrefs] = useState({
    taskAssignments: true,
    commentMentions: true,
    deadlineReminders: true,
    statusChanges: false,
  });

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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.spin}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
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
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
            {myDepartments.length === 0 ? (
              <p className={styles.deptEmpty}>You are not part of any department yet.</p>
            ) : (
              <div className={styles.deptChips}>
                {myDepartments.map((d) => {
                  const isHead = (d.head as any)?.id === user?.id || (d.head as any)?._id === user?.id;
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
              label="Current Password"
              value={currentPassword}
              onChange={(v) => { setCurrentPassword(v); setPwError(''); }}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
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
          <div className={styles.notifSettings}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={notifPrefs.taskAssignments} onChange={(e) => setNotifPrefs((p) => ({ ...p, taskAssignments: e.target.checked }))} />
              <span>Task assignments</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={notifPrefs.commentMentions} onChange={(e) => setNotifPrefs((p) => ({ ...p, commentMentions: e.target.checked }))} />
              <span>Comment mentions</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={notifPrefs.deadlineReminders} onChange={(e) => setNotifPrefs((p) => ({ ...p, deadlineReminders: e.target.checked }))} />
              <span>Deadline reminders</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={notifPrefs.statusChanges} onChange={(e) => setNotifPrefs((p) => ({ ...p, statusChanges: e.target.checked }))} />
              <span>Status changes</span>
            </label>
          </div>
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
