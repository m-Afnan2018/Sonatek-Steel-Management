'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Avatar from '@/components/ui/Avatar/Avatar';
import { useTeam } from '@/hooks/useTeam';
import { useChat } from '@/hooks/useChat';
import styles from './NewChatModal.module.css';
import { Check } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NewChatModal({ open, onClose }: Props) {
  const { members } = useTeam();
  const { openDirect, createGroup } = useChat();

  const [mode, setMode]         = useState<'direct' | 'group'>('direct');
  const [search, setSearch]     = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);

  const filtered = useMemo(
    () => members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [members, search],
  );

  const toggle = (id: string) => {
    if (mode === 'direct') { setSelected([id]); return; }
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleStart = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      if (mode === 'direct') {
        await openDirect(selected[0]);
      } else {
        if (!groupName.trim()) return;
        await createGroup(groupName.trim(), selected);
      }
      onClose();
      setSearch(''); setSelected([]); setGroupName(''); setMode('direct');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="New Chat" size="sm">
      <div className={styles.body}>
        {/* Mode toggle */}
        <div className={styles.modeToggle}>
          <button className={`${styles.modeBtn} ${mode === 'direct' ? styles.modeBtnActive : ''}`} onClick={() => { setMode('direct'); setSelected([]); }}>
            Direct Message
          </button>
          <button className={`${styles.modeBtn} ${mode === 'group' ? styles.modeBtnActive : ''}`} onClick={() => { setMode('group'); setSelected([]); }}>
            New Group
          </button>
        </div>

        {mode === 'group' && (
          <input
            className={styles.groupNameInput}
            placeholder="Group name…"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            autoFocus
          />
        )}

        <input
          className={styles.search}
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus={mode === 'direct'}
        />

        <div className={styles.memberList}>
          {filtered.map((m) => {
            const id  = m.id || (m as any)._id;
            const sel = selected.includes(id);
            return (
              <button
                key={id}
                className={`${styles.memberRow} ${sel ? styles.memberRowSelected : ''}`}
                onClick={() => toggle(id)}
              >
                <Avatar name={m.name} size="sm" />
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{m.name}</span>
                  <span className={styles.memberRole}>{m.role}</span>
                </div>
                {sel && (
                  <Check size={16} strokeWidth={2.5} className={styles.checkIcon} />
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className={styles.noResults}>No members found</p>
          )}
        </div>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleStart}
            loading={loading}
            disabled={!selected.length || (mode === 'group' && !groupName.trim())}
          >
            {mode === 'direct' ? 'Start Chat' : 'Create Group'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
