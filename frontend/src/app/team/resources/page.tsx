'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Modal from '@/components/ui/Modal/Modal';
import Spinner from '@/components/ui/Spinner/Spinner';
import Avatar from '@/components/ui/Avatar/Avatar';
import { useResources } from '@/hooks/useResources';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import type { Resource } from '@/types';
import styles from './resources.module.css';

const conditionVariant = {
  new: 'success' as const,
  good: 'primary' as const,
  fair: 'warning' as const,
  damaged: 'danger' as const,
};

export default function ResourcesPage() {
  const { resources, loading, fetchResources, createResource, returnResource, deleteResource } = useResources();
  const { members } = useTeam();
  const user = useAuthStore((s) => s.user);
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [showCreate, setShowCreate] = useState(false);
  const [filterUser, setFilterUser] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    assignedTo: '',
    serialNumber: '',
    condition: 'new' as Resource['condition'],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchResources(filterUser ? { userId: filterUser } : undefined);
  }, [fetchResources, filterUser]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.assignedTo) return;
    setSaving(true);
    await createResource(form as unknown as Partial<Resource>);
    setSaving(false);
    setShowCreate(false);
    setForm({ name: '', description: '', category: '', assignedTo: '', serialNumber: '', condition: 'new' });
  };

  const handleReturn = async (id: string) => {
    if (!confirm('Mark this resource as returned?')) return;
    await returnResource(id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resource permanently?')) return;
    await deleteResource(id);
  };

  const active = resources.filter((r) => r.isActive);
  const returned = resources.filter((r) => !r.isActive);

  return (
    <AppShell title="Resources">
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.filters}>
            {isAdminOrManager && (
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className={styles.select}
              >
                <option value="">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
          {isAdminOrManager && (
            <Button onClick={() => setShowCreate(true)}>+ Assign Resource</Button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h3 className={styles.sectionTitle}>Active ({active.length})</h3>
                <div className={styles.grid}>
                  {active.map((resource) => (
                    <ResourceCard
                      key={resource._id}
                      resource={resource}
                      canManage={isAdminOrManager}
                      onReturn={handleReturn}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}
            {returned.length > 0 && (
              <section>
                <h3 className={styles.sectionTitle}>Returned ({returned.length})</h3>
                <div className={styles.grid}>
                  {returned.map((resource) => (
                    <ResourceCard
                      key={resource._id}
                      resource={resource}
                      canManage={isAdminOrManager}
                      onReturn={handleReturn}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}
            {resources.length === 0 && (
              <div className={styles.empty}>No resources found.</div>
            )}
          </>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Assign Resource">
        <div className={styles.form}>
          <div className={styles.field}>
            <label>Resource Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MacBook Pro 2023" />
          </div>
          <div className={styles.field}>
            <label>Category</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Laptop, Chair, Monitor..." />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Serial Number</label>
              <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Optional" />
            </div>
            <div className={styles.field}>
              <label>Condition</label>
              <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as Resource['condition'] })}>
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label>Assign To *</label>
            <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
              <option value="">Select member...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.name.trim() || !form.assignedTo}>Assign</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

function ResourceCard({ resource, canManage, onReturn, onDelete }: {
  resource: Resource;
  canManage: boolean;
  onReturn: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`${styles.card} ${!resource.isActive ? styles.returned : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo}>
          <h4 className={styles.cardName}>{resource.name}</h4>
          {resource.category && <span className={styles.category}>{resource.category}</span>}
        </div>
        <Badge variant={conditionVariant[resource.condition]}>{resource.condition}</Badge>
      </div>

      {resource.description && <p className={styles.description}>{resource.description}</p>}

      {resource.serialNumber && (
        <p className={styles.serial}>S/N: {resource.serialNumber}</p>
      )}

      <div className={styles.assignedTo}>
        <Avatar name={resource.assignedTo.name} size="sm" />
        <div>
          <span className={styles.assignedName}>{resource.assignedTo.name}</span>
          <span className={styles.assignedDate}>
            {resource.isActive ? `Since ${formatDate(resource.assignedAt)}` : `Returned ${formatDate(resource.returnedAt || '')}`}
          </span>
        </div>
      </div>

      {canManage && resource.isActive && (
        <div className={styles.cardActions}>
          <Button size="sm" variant="secondary" onClick={() => onReturn(resource._id)}>Mark Returned</Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(resource._id)}>Delete</Button>
        </div>
      )}
    </div>
  );
}
