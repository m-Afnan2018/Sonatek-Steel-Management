'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Avatar from '@/components/ui/Avatar/Avatar';
import Badge from '@/components/ui/Badge/Badge';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { useDepartments } from '@/hooks/useDepartments';
import api from '@/lib/api';
import styles from './settings.module.css';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const updateUser = useAuthStore((s) => s.updateUser);
  const { departments } = useDepartments();

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [notifPrefs, setNotifPrefs] = useState({
    taskAssignments: true,
    commentMentions: true,
    deadlineReminders: true,
    statusChanges: false,
  });

  // Departments this user belongs to
  const myDepartments = useMemo(() =>
    departments.filter((d) =>
      d.members.some((m) => m.id === user?.id || (m as any)._id === user?.id)
    ),
    [departments, user?.id]
  );

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage('Name cannot be empty.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const { data } = await api.put('/auth/me', { name: name.trim() });
      updateUser({ name: data.name });
      setMessage('Profile updated successfully.');
    } catch {
      setMessage('Failed to update profile.');
    }
    setSaving(false);
  };

  return (
    <AppShell title="Settings">
      <div className={styles.page}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile</h2>
          <div className={styles.profile}>
            <Avatar name={name || 'U'} size="lg" />
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
                onChange={(e) => { setName(e.target.value); setMessage(''); }}
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

            {message && (
              <p className={message.includes('Failed') || message.includes('empty') ? styles.error : styles.success}>
                {message}
              </p>
            )}

            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
          </div>

          {/* Departments — linked from Department collection */}
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

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Notifications</h2>
          <div className={styles.notifSettings}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notifPrefs.taskAssignments}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, taskAssignments: e.target.checked }))}
              />
              <span>Task assignments</span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notifPrefs.commentMentions}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, commentMentions: e.target.checked }))}
              />
              <span>Comment mentions</span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notifPrefs.deadlineReminders}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, deadlineReminders: e.target.checked }))}
              />
              <span>Deadline reminders</span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notifPrefs.statusChanges}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, statusChanges: e.target.checked }))}
              />
              <span>Status changes</span>
            </label>
          </div>
        </div>

        <div className={styles.dangerZone}>
          <h2 className={styles.sectionTitle}>Danger Zone</h2>
          <Button variant="danger" onClick={logout}>Sign Out</Button>
        </div>
      </div>
    </AppShell>
  );
}
