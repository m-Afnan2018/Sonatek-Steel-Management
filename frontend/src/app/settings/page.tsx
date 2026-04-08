'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Avatar from '@/components/ui/Avatar/Avatar';
import Badge from '@/components/ui/Badge/Badge';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import styles from './settings.module.css';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const updateUser = useAuthStore((s) => s.updateUser);

  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [notifPrefs, setNotifPrefs] = useState({
    taskAssignments: true,
    commentMentions: true,
    deadlineReminders: true,
    statusChanges: false,
  });

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage('Name cannot be empty.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const { data } = await api.put('/auth/me', { name: name.trim(), department });
      updateUser({ name: data.name, department: data.department });
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
              <label>Department</label>
              <input
                value={department}
                onChange={(e) => { setDepartment(e.target.value); setMessage(''); }}
                placeholder="e.g. Engineering"
              />
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
