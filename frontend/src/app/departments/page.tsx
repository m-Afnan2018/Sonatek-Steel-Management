'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Avatar from '@/components/ui/Avatar/Avatar';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import type { Department, User } from '@/types';
import styles from './departments.module.css';

/** Safely extract string ID from a User — handles both `id` and `_id` */
function uid(m: User | any): string {
  return (m?.id || m?._id)?.toString() ?? '';
}

const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

function colorToLight(hex: string) {
  return hex + '22';
}

// ── Confirm Dialog ────────────────────────────────────────────────
function ConfirmModal({
  isOpen, onClose, onConfirm, title, message,
}: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className={styles.confirmMsg}>{message}</p>
      <div className={styles.confirmActions}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  );
}

// ── Department Form Modal ─────────────────────────────────────────
function DeptFormModal({
  isOpen, onClose, onSave, initial,
}: {
  isOpen: boolean; onClose: () => void;
  onSave: (v: { name: string; description: string; color: string; canSocialMedia: boolean }) => Promise<void>;
  initial?: { name: string; description: string; color: string; canSocialMedia: boolean };
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [canSocialMedia, setCanSocialMedia] = useState(initial?.canSocialMedia ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description: desc.trim(), color, canSocialMedia });
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? 'Edit Department' : 'Create Department'}
      size="md"
    >
      <div className={styles.formBody}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Name <span className={styles.req}>*</span></label>
          <input
            className={styles.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Engineering"
            autoFocus
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Description</label>
          <textarea
            className={styles.formTextarea}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What does this department do?"
            rows={3}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Color</label>
          <div className={styles.palette}>
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchActive : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className={styles.formField}>
          <div className={styles.toggleRow}>
            <div>
              <label className={styles.formLabel}>Social Media Access</label>
              <p className={styles.toggleHint}>
                Allow this department's heads to see the Social Media tab inside projects.
              </p>
            </div>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={canSocialMedia}
                onChange={(e) => setCanSocialMedia(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Department'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add Member Modal ──────────────────────────────────────────────
function AddMemberModal({
  isOpen, onClose, onAdd, dept, allMembers,
}: {
  isOpen: boolean; onClose: () => void;
  onAdd: (userId: string) => Promise<void>;
  dept: Department; allMembers: User[];
}) {
  const existingIds = new Set(dept.members.map((m) => uid(m)));
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState('');

  const filtered = allMembers.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (userId: string) => {
    setAdding(userId);
    await onAdd(userId);
    setAdding('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Member" size="sm">
      <div className={styles.addMemberBody}>
        <input
          className={styles.formInput}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.addMemberList}>
          {filtered.length === 0 && (
            <p className={styles.emptyText}>No results.</p>
          )}
          {filtered.map((m) => {
            const memberId = uid(m);
            const alreadyIn = existingIds.has(memberId);
            return (
              <div key={memberId} className={styles.addMemberItem}>
                <Avatar name={m.name} size="sm" />
                <div className={styles.addMemberInfo}>
                  <span className={styles.addMemberName}>{m.name}</span>
                  <span className={styles.addMemberEmail}>{m.email}</span>
                </div>
                {alreadyIn ? (
                  <Button size="sm" variant="secondary" disabled>Added</Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleAdd(memberId)}
                    disabled={!!adding}
                  >
                    {adding === memberId ? '…' : 'Add'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const {
    departments, loading, error,
    createDepartment, updateDepartment, deleteDepartment,
    addMember, removeMember, addHead, removeHead,
  } = useDepartments();
  const { members: allMembers } = useTeam();
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.role === 'admin';
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [selected, setSelected] = useState<Department | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [actionError, setActionError] = useState('');

  // Keep selected in sync with departments updates
  const selectedDept = selected
    ? departments.find((d) => d._id === selected._id) ?? selected
    : null;

  const handleCreate = async (v: { name: string; description: string; color: string; canSocialMedia: boolean }) => {
    const dept = await createDepartment(v);
    if (dept) setSelected(dept);
  };

  const handleUpdate = async (v: { name: string; description: string; color: string; canSocialMedia: boolean }) => {
    if (!selectedDept) return;
    await updateDepartment(selectedDept._id, v);
  };

  const handleDelete = async () => {
    if (!selectedDept) return;
    await deleteDepartment(selectedDept._id);
    setSelected(null);
    setShowConfirmDelete(false);
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedDept) return;
    setActionError('');
    const updated = await addMember(selectedDept._id, userId);
    if (updated) setSelected(updated);
    else setActionError(error || 'Failed to add member. Please try again.');
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedDept) return;
    setActionError('');
    const { data: updated, error: removeError } = await removeMember(selectedDept._id, userId);
    if (updated) setSelected(updated);
    else setActionError(removeError || 'Failed to remove member. Please try again.');
  };

  const handleAddHead = async (userId: string) => {
    if (!selectedDept) return;
    await addHead(selectedDept._id, userId);
  };

  const handleRemoveHead = async (userId: string) => {
    if (!selectedDept) return;
    await removeHead(selectedDept._id, userId);
  };

  return (
    <AppShell title="Departments">
      <div className={styles.layout}>

        {/* ── Left: Department list sidebar ── */}
        <aside className={styles.listPanel}>
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>Departments</h2>
            {isAdmin && (
              <button className={styles.newBtn} onClick={() => setShowCreate(true)} title="New department">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
          </div>

          {loading ? (
            <div className={styles.listLoading}><Spinner size="sm" /></div>
          ) : departments.length === 0 ? (
            <div className={styles.listEmpty}>
              <span>No departments yet.</span>
              {isAdmin && (
                <button className={styles.linkBtn} onClick={() => setShowCreate(true)}>
                  Create your first department
                </button>
              )}
            </div>
          ) : (
            <ul className={styles.deptList}>
              {departments.map((d) => (
                <li key={d._id}>
                  <button
                    className={`${styles.deptItem} ${selectedDept?._id === d._id ? styles.deptItemActive : ''}`}
                    onClick={() => setSelected(d)}
                  >
                    <span
                      className={styles.deptDot}
                      style={{ background: d.color }}
                    />
                    <div className={styles.deptItemInfo}>
                      <span className={styles.deptItemName}>{d.name}</span>
                      <span className={styles.deptItemCount}>
                        {d.members.length} {d.members.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    {selectedDept?._id === d._id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.chevron}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Right: Department detail ── */}
        <div className={styles.detailPanel}>
          {!selectedDept ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <h3 className={styles.emptyTitle}>Select a department</h3>
              <p className={styles.emptyDesc}>Choose a department from the sidebar to view its members and details.</p>
              {isAdmin && (
                <Button onClick={() => setShowCreate(true)}>Create Department</Button>
              )}
            </div>
          ) : (
            <div className={styles.detail}>

              {/* ── Detail header ── */}
              <div
                className={styles.detailHeader}
                style={{ borderColor: selectedDept.color, background: colorToLight(selectedDept.color) }}
              >
                <div className={styles.detailHeaderLeft}>
                  <div
                    className={styles.detailColorBadge}
                    style={{ background: selectedDept.color }}
                  />
                  <div>
                    <h1 className={styles.detailName}>{selectedDept.name}</h1>
                    {selectedDept.description && (
                      <p className={styles.detailDesc}>{selectedDept.description}</p>
                    )}
                    <div className={styles.detailMeta}>
                      <span className={styles.detailMetaItem}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                        </svg>
                        {selectedDept.members.length} {selectedDept.members.length === 1 ? 'member' : 'members'}
                      </span>
                      {selectedDept.heads && selectedDept.heads.length > 0 && (
                        <span className={styles.detailMetaItem}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {selectedDept.heads.length === 1 ? 'Head' : 'Heads'}:{' '}
                          {selectedDept.heads.map((h) => h.name).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className={styles.detailActions}>
                    <button className={styles.iconBtn} onClick={() => setShowEdit(true)} title="Edit">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => setShowConfirmDelete(true)}
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* ── Members section ── */}
              <div className={styles.membersSection}>
                {actionError && (
                  <div className={styles.actionError} onClick={() => setActionError('')}>
                    {actionError}
                  </div>
                )}
                <div className={styles.membersSectionHeader}>
                  <h2 className={styles.membersSectionTitle}>
                    Members
                    <span className={styles.memberCount} style={{ background: colorToLight(selectedDept.color), color: selectedDept.color }}>
                      {selectedDept.members.length}
                    </span>
                  </h2>
                  {isAdminOrManager && (
                    <Button size="sm" onClick={() => setShowAddMember(true)}>
                      + Add Member
                    </Button>
                  )}
                </div>

                {selectedDept.members.length === 0 ? (
                  <div className={styles.noMembers}>
                    <p>No members yet.</p>
                    {isAdminOrManager && (
                      <button className={styles.linkBtn} onClick={() => setShowAddMember(true)}>
                        Add the first member
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={styles.membersGrid}>
                    {selectedDept.members.map((m) => {
                      const memberId = uid(m);
                      const isHead = selectedDept.heads?.some((h) => uid(h) === memberId) ?? false;
                      return (
                        <div key={memberId} className={styles.memberCard}>
                          <div className={styles.memberCardTop}>
                            <div className={styles.memberAvatarWrap}>
                              <Avatar name={m.name} size="md" />
                              {isHead && (
                                <span className={styles.headBadge} title="Department Head">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <div className={styles.memberCardInfo}>
                              <span className={styles.memberCardName}>{m.name}</span>
                              <span className={styles.memberCardRole}>{m.role}</span>
                              <span className={styles.memberCardEmail}>{m.email}</span>
                            </div>
                          </div>
                          {isAdminOrManager && (
                            <div className={styles.memberCardActions}>
                              {isAdmin && !isHead && (
                                <button
                                  className={styles.memberActionBtn}
                                  title="Set as head"
                                  onClick={() => handleAddHead(memberId)}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                  Make Head
                                </button>
                              )}
                              {isAdmin && isHead && (
                                <button
                                  className={`${styles.memberActionBtn} ${styles.memberActionBtnHead}`}
                                  title="Remove as head"
                                  onClick={() => handleRemoveHead(memberId)}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                  Remove as Head
                                </button>
                              )}
                              <button
                                className={`${styles.memberActionBtn} ${styles.memberActionBtnRemove}`}
                                title="Remove from department"
                                onClick={() => handleRemoveMember(memberId)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <DeptFormModal
          isOpen
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {showEdit && selectedDept && (
        <DeptFormModal
          isOpen
          onClose={() => setShowEdit(false)}
          onSave={handleUpdate}
          initial={{
            name: selectedDept.name,
            description: selectedDept.description || '',
            color: selectedDept.color,
            canSocialMedia: selectedDept.canSocialMedia ?? false,
          }}
        />
      )}

      {showConfirmDelete && selectedDept && (
        <ConfirmModal
          isOpen
          onClose={() => setShowConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Delete Department"
          message={`Delete "${selectedDept.name}"? This will remove all ${selectedDept.members.length} member(s) from the department. This cannot be undone.`}
        />
      )}

      {showAddMember && selectedDept && (
        <AddMemberModal
          isOpen
          onClose={() => setShowAddMember(false)}
          onAdd={handleAddMember}
          dept={selectedDept}
          allMembers={allMembers}
        />
      )}
    </AppShell>
  );
}
