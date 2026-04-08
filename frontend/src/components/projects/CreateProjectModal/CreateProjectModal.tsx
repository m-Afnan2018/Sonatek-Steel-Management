'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import type { User } from '@/types';
import styles from './CreateProjectModal.module.css';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    priority: string;
    startDate: string;
    endDate: string;
    members: { user: string; role: string }[];
    tags: string[];
  }) => void;
  members: User[];
}

export default function CreateProjectModal({ isOpen, onClose, onSubmit, members }: CreateProjectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) return;

    onSubmit({
      title,
      description,
      priority,
      startDate,
      endDate,
      members: selectedMembers.map((id) => ({ user: id, role: 'member' })),
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    });

    // Reset
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStartDate('');
    setEndDate('');
    setSelectedMembers([]);
    setTagsInput('');
    onClose();
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Project" size="md">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label>Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            required
          />
        </div>

        <div className={styles.field}>
          <label>Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Project description..."
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Start Date *</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label>End Date *</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
        </div>

        <div className={styles.field}>
          <label>Tags (comma separated)</label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="frontend, design, api"
          />
        </div>

        <div className={styles.field}>
          <label>Members</label>
          <div className={styles.memberList}>
            {members.map((m) => (
              <label key={m.id} className={styles.memberCheck}>
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(m.id)}
                  onChange={() => toggleMember(m.id)}
                />
                <span>{m.name}</span>
                <span className={styles.memberRole}>{m.role}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create Project</Button>
        </div>
      </form>
    </Modal>
  );
}
