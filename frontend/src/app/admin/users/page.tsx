'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Modal from '@/components/ui/Modal/Modal';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import type { User } from '@/types';
import styles from './users.module.css';

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'member', lateThreshold: '09:30',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', role: 'member', lateThreshold: '09:30' });
    setError('');
    setShowPwd(false);
    setShowEditPwd(false);
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      setError('Name, email and password are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/users', form);
      await fetchUsers();
      setShowCreate(false);
      resetForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create user.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: form.name,
        email: form.email,
        role: form.role,
        lateThreshold: form.lateThreshold,
      };
      if (form.password) payload.password = form.password;
      await api.put(`/admin/users/${editUser.id}`, payload);
      await fetchUsers();
      setEditUser(null);
      resetForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update user.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/toggle-active`);
      await fetchUsers();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user permanently? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      await fetchUsers();
    } catch {
      // ignore
    }
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, lateThreshold: u.lateThreshold || '09:30' });
    setError('');
  };

  const roleVariant: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
    admin: 'danger',
    manager: 'warning',
    member: 'primary',
    viewer: 'default',
  };

  if (currentUser?.role !== 'admin') {
    return <AppShell title="Admin: Users"><div className={styles.denied}>Access denied. Admin only.</div></AppShell>;
  }

  return (
    <AppShell title="Admin: Users">
      <div className={styles.page}>
        <div className={styles.header}>
          <p className={styles.subtitle}>{users.length} total users</p>
          <Button onClick={() => { setShowCreate(true); resetForm(); }}>+ Create User</Button>
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Late Threshold</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id || (u as unknown as { _id: string })._id}>
                    <td>
                      <div className={styles.userCell}>
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <span className={styles.userName}>{u.name}</span>
                          <span className={styles.userEmail}>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant={roleVariant[u.role]}>{u.role}</Badge></td>
                    <td><span className={styles.threshold}>{u.lateThreshold || '09:30'}</span></td>
                    <td>
                      <Badge variant={u.isActive ? 'success' : 'default'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn} onClick={() => openEdit(u)} title="Edit">✏️</button>
                        {u.id !== currentUser?.id && (
                          <>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleToggleActive(u.id || (u as unknown as { _id: string })._id)}
                              title={u.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {u.isActive ? '🔒' : '🔓'}
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.danger}`}
                              onClick={() => handleDelete(u.id || (u as unknown as { _id: string })._id)}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New User">
        <div className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Full Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className={styles.field}>
              <label>Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Password *</label>
              <div className={styles.pwdWrap}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 characters"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd((v) => !v)} tabIndex={-1}>
                  {showPwd ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className={styles.field}>
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Late Threshold (HH:MM)</label>
              <input value={form.lateThreshold} onChange={(e) => setForm({ ...form, lateThreshold: e.target.value })} placeholder="09:30" />
            </div>
          </div>
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create User</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Edit: ${editUser?.name}`}>
        <div className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Full Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>New Password (leave blank to keep)</label>
              <div className={styles.pwdWrap}>
                <input
                  type={showEditPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="New password..."
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowEditPwd((v) => !v)} tabIndex={-1}>
                  {showEditPwd ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className={styles.field}>
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Late Threshold (HH:MM)</label>
              <input value={form.lateThreshold} onChange={(e) => setForm({ ...form, lateThreshold: e.target.value })} />
            </div>
          </div>
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleUpdate} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
