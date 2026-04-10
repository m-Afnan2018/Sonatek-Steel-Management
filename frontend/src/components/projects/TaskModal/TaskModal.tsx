'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import { formatDate, formatStatus, timeAgo } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import type { Task, Comment, User } from '@/types';
import styles from './TaskModal.module.css';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  members: User[];
}

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

export default function TaskModal({ task, isOpen, onClose, onUpdate, members }: TaskModalProps) {
  const { updateTask, addComment, logHours: logTaskHours } = useTasks();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [hoursInput, setHoursInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', remark: '', priority: '', status: '', dueDate: '' });
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  useEffect(() => {
    if (task) {
      setEditData({
        title: task.title,
        description: task.description || '',
        remark: task.remark || '',
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      });
      setComments(task.comments || []);
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    const updated = await updateTask(task._id, editData as unknown as Partial<Task>);
    if (updated) {
      onUpdate(updated);
      setEditing(false);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    const mentionRegex = /@(\w+)/g;
    const mentionNames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      mentionNames.push(match[1]);
    }
    const mentionIds = members
      .filter((m) => mentionNames.some((name) => m.name.toLowerCase().includes(name.toLowerCase())))
      .map((m) => m.id);

    const comment = await addComment(task._id, newComment, mentionIds);
    if (comment) {
      setComments((prev) => [comment, ...prev]);
      setNewComment('');
    }
  };

  const handleLogHours = async () => {
    const h = parseFloat(hoursInput);
    if (isNaN(h) || h <= 0) return;
    await logTaskHours(task._id, h);
    setHoursInput('');
  };

  const handleCommentChange = (value: string) => {
    setNewComment(value);
    const lastAt = value.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === value.length - 1 || !value.substring(lastAt).includes(' '))) {
      setMentionSearch(value.substring(lastAt + 1));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const lastAt = newComment.lastIndexOf('@');
    setNewComment(newComment.substring(0, lastAt) + '@' + name + ' ');
    setShowMentions(false);
  };

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Task' : task.title} size="lg">
      <div className={styles.content}>
        {editing ? (
          <div className={styles.form}>
            <div className={styles.field}>
              <label>Title</label>
              <input
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label>Description</label>
              <textarea
                rows={4}
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label>Remark</label>
              <input
                value={editData.remark}
                onChange={(e) => setEditData({ ...editData, remark: e.target.value })}
                placeholder="Short remark or note"
              />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Status</label>
                <select
                  value={editData.status}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Priority</label>
                <select
                  value={editData.priority}
                  onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Due Date</label>
                <input
                  type="date"
                  value={editData.dueDate}
                  onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.meta}>
              <div className={styles.metaItem}>
                <span className={styles.label}>Status</span>
                <Badge variant="primary">{formatStatus(task.status)}</Badge>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.label}>Priority</span>
                <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
              </div>
              {task.dueDate && (
                <div className={styles.metaItem}>
                  <span className={styles.label}>Due Date</span>
                  <span>{formatDate(task.dueDate)}</span>
                </div>
              )}
              <div className={styles.metaItem}>
                <span className={styles.label}>Reporter</span>
                <div className={styles.person}>
                  <Avatar name={task.reporter?.name || 'U'} size="sm" />
                  <span>{task.reporter?.name}</span>
                </div>
              </div>
            </div>

            {task.description && (
              <div className={styles.section}>
                <h4>Description</h4>
                <p className={styles.description}>{task.description}</p>
              </div>
            )}

            {task.remark && (
              <div className={styles.section}>
                <h4>Remark</h4>
                <p className={styles.remark}>{task.remark}</p>
              </div>
            )}

            <div className={styles.section}>
              <h4>Assignees</h4>
              <div className={styles.assignees}>
                {task.assignees.map((a) => (
                  <div key={a.id || a.email} className={styles.person}>
                    <Avatar name={a.name} size="sm" />
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h4>Time Tracking</h4>
              <p className={styles.timeInfo}>
                {Math.floor(task.totalElapsedSeconds / 60)}m logged{task.estimatedHours ? ` / ${task.estimatedHours}h estimated` : ''}
              </p>
              <div className={styles.logHours}>
                <input
                  type="number"
                  placeholder="Hours"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                  min="0"
                  step="0.5"
                />
                <Button size="sm" onClick={handleLogHours}>Log</Button>
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit Task
            </Button>

            <div className={styles.section}>
              <h4>Comments</h4>
              <div className={styles.commentInput}>
                <div className={styles.mentionWrapper}>
                  <textarea
                    rows={2}
                    placeholder="Add a comment... Use @name to mention"
                    value={newComment}
                    onChange={(e) => handleCommentChange(e.target.value)}
                  />
                  {showMentions && filteredMembers.length > 0 && (
                    <div className={styles.mentionDropdown}>
                      {filteredMembers.slice(0, 5).map((m) => (
                        <button
                          key={m.id}
                          className={styles.mentionItem}
                          onClick={() => insertMention(m.name.split(' ')[0])}
                        >
                          <Avatar name={m.name} size="sm" />
                          <span>{m.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" onClick={handleComment}>Post</Button>
              </div>
              <div className={styles.commentList}>
                {comments.map((c) => (
                  <div key={c._id} className={styles.comment}>
                    <Avatar name={c.author?.name || 'U'} size="sm" />
                    <div>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentAuthor}>{c.author?.name}</span>
                        <span className={styles.commentTime}>{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className={styles.commentText}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
