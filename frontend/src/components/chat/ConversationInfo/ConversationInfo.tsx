'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Crown,
  UserMinus,
  UserPlus,
  LogOut,
  BellOff,
  Archive,
  CheckCircle,
  Pencil,
  Search,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar/Avatar';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';
import api from '@/lib/api';
import type { Conversation, ChatUser } from '@/store/chatStore';
import styles from './ConversationInfo.module.css';

function uid(u: ChatUser): string {
  return (u?._id || u?.id) ?? '';
}

interface Props {
  conversation: Conversation;
  currentUserId: string;
  onClose: () => void;
}

export default function ConversationInfo({ conversation, currentUserId, onClose }: Props) {
  const { onlineUsers } = useChatStore();
  const {
    updateConversationSettings,
    addMembers,
    removeMember,
    leaveConversation,
  } = useChat();

  const isGroup = conversation.type !== 'direct';
  const isAdmin = conversation.admins?.some((a) => uid(a) === currentUserId);
  const otherUser = !isGroup
    ? conversation.participants.find((p) => uid(p) !== currentUserId)
    : null;

  const [isMuted, setIsMuted]       = useState(conversation.isMuted);
  const [isArchived, setIsArchived] = useState(conversation.isArchived);
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName]   = useState(conversation.name || '');
  const [savingName, setSavingName] = useState(false);

  // Add members
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [userSearch, setUserSearch]         = useState('');
  const [allUsers, setAllUsers]             = useState<ChatUser[]>([]);
  const [addingIds, setAddingIds]           = useState<Set<string>>(new Set());

  // Leave confirm
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isOnline = otherUser
    ? onlineUsers.has(uid(otherUser))
    : false;

  const handleMuteToggle = async () => {
    const next = !isMuted;
    setIsMuted(next);
    try {
      await updateConversationSettings(conversation._id, { isMuted: next });
    } catch {
      setIsMuted(!next);
    }
  };

  const handleArchiveToggle = async () => {
    const next = !isArchived;
    setIsArchived(next);
    try {
      await updateConversationSettings(conversation._id, { isArchived: next });
    } catch {
      setIsArchived(!next);
    }
  };

  const handleSaveName = async () => {
    if (!groupName.trim() || groupName === conversation.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await api.patch(`/chat/${conversation._id}`, { name: groupName.trim() });
      setEditingName(false);
    } catch {
      // revert
      setGroupName(conversation.name || '');
    } finally {
      setSavingName(false);
    }
  };

  const loadUsers = useCallback(async () => {
    const { data } = await api.get<ChatUser[]>('/users');
    setAllUsers(data);
  }, []);

  const handleShowAddMembers = () => {
    setShowAddMembers(true);
    if (allUsers.length === 0) loadUsers();
  };

  const handleAddMember = async (userId: string) => {
    setAddingIds((prev) => new Set(prev).add(userId));
    try {
      await addMembers(conversation._id, [userId]);
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId);
    setActionLoading(true);
    try {
      await removeMember(conversation._id, userId);
    } finally {
      setRemovingId(null);
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      await leaveConversation(conversation._id);
      onClose();
    } finally {
      setActionLoading(false);
      setShowLeaveConfirm(false);
    }
  };

  const existingMemberIds = new Set(conversation.participants.map(uid));

  const filteredUsers = allUsers.filter((u) => {
    const id = uid(u);
    if (existingMemberIds.has(id)) return false;
    if (id === currentUserId) return false;
    if (!userSearch.trim()) return true;
    return u.name.toLowerCase().includes(userSearch.toLowerCase());
  });

  const convName = isGroup
    ? (conversation.name || 'Group')
    : (otherUser?.name || 'Chat');

  return (
    <div className={styles.panel}>
      {/* Panel header */}
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          {isGroup ? 'Group info' : 'Contact info'}
        </h3>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close info panel">
          <X size={18} />
        </button>
      </div>

      <div className={styles.scrollArea}>
        {/* Avatar + name section */}
        <div className={styles.heroSection}>
          <div className={styles.avatarWrap}>
            {conversation.avatar ? (
              <img src={conversation.avatar} alt={convName} className={styles.heroImg} />
            ) : (
              <Avatar name={convName} size="lg" />
            )}
            {!isGroup && isOnline && <span className={styles.onlineDot} />}
          </div>

          {/* Editable group name */}
          {isGroup && editingName ? (
            <div className={styles.editNameWrap}>
              <input
                className={styles.editNameInput}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') { setEditingName(false); setGroupName(conversation.name || ''); }
                }}
                autoFocus
                maxLength={60}
              />
              <button
                className={styles.saveNameBtn}
                onClick={handleSaveName}
                disabled={savingName}
              >
                <CheckCircle size={16} />
              </button>
            </div>
          ) : (
            <div className={styles.heroNameRow}>
              <h4 className={styles.heroName}>{convName}</h4>
              {isGroup && isAdmin && (
                <button
                  className={styles.editNameBtn}
                  onClick={() => setEditingName(true)}
                  title="Edit group name"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}

          <p className={styles.heroSub}>
            {isGroup
              ? `${conversation.participants.length} members`
              : isOnline ? 'Online' : 'Offline'}
          </p>
        </div>

        {/* Settings toggles */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Settings</p>
          <div className={styles.settingRow} onClick={handleMuteToggle}>
            <span className={styles.settingIcon}><BellOff size={15} /></span>
            <span className={styles.settingLabel}>Mute notifications</span>
            <div className={`${styles.toggle} ${isMuted ? styles.toggleOn : ''}`}>
              <div className={styles.toggleThumb} />
            </div>
          </div>
          <div className={styles.settingRow} onClick={handleArchiveToggle}>
            <span className={styles.settingIcon}><Archive size={15} /></span>
            <span className={styles.settingLabel}>Archive conversation</span>
            <div className={`${styles.toggle} ${isArchived ? styles.toggleOn : ''}`}>
              <div className={styles.toggleThumb} />
            </div>
          </div>
        </div>

        {/* Group members */}
        {isGroup && (
          <div className={styles.section}>
            <div className={styles.membersHeader}>
              <p className={styles.sectionTitle}>
                Members ({conversation.participants.length})
              </p>
              {isAdmin && (
                <button
                  className={styles.addMemberBtn}
                  onClick={handleShowAddMembers}
                  title="Add members"
                >
                  <UserPlus size={14} />
                  Add
                </button>
              )}
            </div>

            {/* Add members search */}
            {showAddMembers && (
              <div className={styles.addMembersPanel}>
                <div className={styles.searchRow}>
                  <Search size={13} className={styles.searchIcon} />
                  <input
                    className={styles.memberSearchInput}
                    placeholder="Search users…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.userList}>
                  {filteredUsers.length === 0 ? (
                    <p className={styles.noUsers}>
                      {userSearch ? 'No users found' : 'All users are already members'}
                    </p>
                  ) : (
                    filteredUsers.map((u) => {
                      const userId = uid(u);
                      const isAdding = addingIds.has(userId);
                      const alreadyAdded = existingMemberIds.has(userId);
                      return (
                        <div key={userId} className={styles.userItem}>
                          <Avatar name={u.name} size="sm" />
                          <span className={styles.userName}>{u.name}</span>
                          {alreadyAdded ? (
                            <span className={styles.addedBadge}>Added</span>
                          ) : (
                            <button
                              className={styles.addUserBtn}
                              onClick={() => handleAddMember(userId)}
                              disabled={isAdding}
                            >
                              {isAdding ? '…' : <UserPlus size={13} />}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  className={styles.closePanelBtn}
                  onClick={() => { setShowAddMembers(false); setUserSearch(''); }}
                >
                  Done
                </button>
              </div>
            )}

            {/* Members list */}
            <div className={styles.memberList}>
              {conversation.participants.map((member) => {
                const memberId = uid(member);
                const memberIsAdmin = conversation.admins?.some((a) => uid(a) === memberId);
                const isSelf = memberId === currentUserId;
                const isRemoving = removingId === memberId && actionLoading;

                return (
                  <div key={memberId} className={styles.memberItem}>
                    <Avatar name={member.name} size="sm" />
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>
                        {member.name} {isSelf && <span className={styles.youBadge}>(you)</span>}
                      </span>
                      {memberIsAdmin && (
                        <span className={styles.adminBadge}>
                          <Crown size={10} /> Admin
                        </span>
                      )}
                    </div>
                    {isAdmin && !isSelf && (
                      <button
                        className={styles.removeBtn}
                        onClick={() => handleRemoveMember(memberId)}
                        disabled={isRemoving}
                        title={`Remove ${member.name}`}
                      >
                        {isRemoving ? '…' : <UserMinus size={13} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Leave group */}
        {isGroup && (
          <div className={styles.section}>
            {showLeaveConfirm ? (
              <div className={styles.leaveConfirm}>
                <p className={styles.leaveConfirmText}>Are you sure you want to leave this group?</p>
                <div className={styles.leaveConfirmActions}>
                  <button
                    className={styles.cancelLeaveBtn}
                    onClick={() => setShowLeaveConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.confirmLeaveBtn}
                    onClick={handleLeave}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Leaving…' : 'Leave group'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={styles.leaveBtn}
                onClick={() => setShowLeaveConfirm(true)}
              >
                <LogOut size={15} />
                Leave group
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
