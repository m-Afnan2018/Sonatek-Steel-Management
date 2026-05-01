import { Request, Response } from 'express';
import { getIO } from '../socket/chatSocket';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import UserChatSettings from '../models/UserChatSettings';
import SavedMessage from '../models/SavedMessage';

// ── helpers ───────────────────────────────────────────────────────────────────

async function ensureSettings(userId: string, conversationId: string) {
  await UserChatSettings.findOneAndUpdate(
    { user: userId, conversation: conversationId },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

// ── Conversations ─────────────────────────────────────────────────────────────

export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'name email avatar role lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name avatar' } })
      .sort({ lastActivity: -1 });

    const settings = await UserChatSettings.find({ user: userId });
    const settingsMap = new Map(settings.map((s) => [s.conversation.toString(), s]));

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const s = settingsMap.get(conv._id.toString());
        const lastReadAt = s?.lastReadAt ?? new Date(0);
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          createdAt: { $gt: lastReadAt },
          deletedForEveryone: false,
          deletedFor: { $ne: userId },
        });
        return {
          ...conv.toObject(),
          unreadCount,
          isMuted:    s?.isMuted    ?? false,
          isPinned:   s?.isPinned   ?? false,
          isArchived: s?.isArchived ?? false,
        };
      }),
    );

    res.json(result);
  } catch (err) {
    console.error('getConversations:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getOrCreateDirect = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { targetUserId } = req.body;

    if (!targetUserId || targetUserId === userId) {
      res.status(400).json({ message: 'Invalid targetUserId.' });
      return;
    }

    let conv = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [userId, targetUserId], $size: 2 },
    }).populate('participants', 'name email avatar role lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name avatar' } });

    if (!conv) {
      conv = await Conversation.create({
        type: 'direct',
        participants: [userId, targetUserId],
        admins: [],
        createdBy: userId,
      });
      conv = await conv.populate('participants', 'name email avatar role lastSeen');
    }

    await ensureSettings(userId, conv._id.toString());
    await ensureSettings(targetUserId, conv._id.toString());
    res.status(201).json(conv);
  } catch (err) {
    console.error('getOrCreateDirect:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, memberIds = [] } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ message: 'Group name is required.' });
      return;
    }

    const participants = Array.from(new Set([userId, ...memberIds])) as string[];

    const conv = await Conversation.create({
      type: 'group',
      name: name.trim(),
      participants,
      admins: [userId],
      createdBy: userId,
    });

    await Promise.all(participants.map((id) => ensureSettings(id, conv._id.toString())));
    const populated = await conv.populate('participants', 'name email avatar role lastSeen');
    res.status(201).json(populated);
  } catch (err) {
    console.error('createGroup:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conv = await Conversation.findOne({ _id: req.params.id, participants: userId })
      .populate('participants', 'name email avatar role lastSeen')
      .populate('admins', 'name email avatar');
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }
    res.json(conv);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, description, avatar } = req.body;

    const conv = await Conversation.findOne({ _id: req.params.id, participants: userId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }
    if (conv.type === 'department') {
      res.status(403).json({ message: 'Department groups are managed automatically.' }); return;
    }
    const isAdmin = conv.admins.some((a) => a.toString() === userId);
    if (conv.type === 'group' && !isAdmin) {
      res.status(403).json({ message: 'Only group admins can edit.' }); return;
    }

    if (name        !== undefined) conv.name        = name.trim();
    if (description !== undefined) conv.description = description.trim();
    if (avatar      !== undefined) conv.avatar      = avatar;
    await conv.save();

    res.json(await conv.populate('participants', 'name email avatar role lastSeen'));
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { memberIds = [] } = req.body;

    const conv = await Conversation.findOne({ _id: req.params.id, participants: userId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }
    if (conv.type === 'direct') { res.status(400).json({ message: 'Cannot add members to a direct chat.' }); return; }

    const isAdmin = conv.admins.some((a) => a.toString() === userId);
    const isGlobalAdmin = req.user!.role === 'admin' || req.user!.role === 'manager';
    if (!isAdmin && !isGlobalAdmin) {
      res.status(403).json({ message: 'Only admins can add members.' }); return;
    }

    const newIds = (memberIds as string[]).filter(
      (id) => !conv.participants.some((p) => p.toString() === id),
    );
    conv.participants.push(...newIds.map((id) => new mongoose.Types.ObjectId(id)));
    await conv.save();
    await Promise.all(newIds.map((id) => ensureSettings(id, conv._id.toString())));

    res.json(await conv.populate('participants', 'name email avatar role lastSeen'));
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const requesterId = req.user!.id;
    const targetId    = req.params.userId;

    const conv = await Conversation.findOne({ _id: req.params.id, participants: requesterId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }
    if (conv.type !== 'group') { res.status(400).json({ message: 'Only applicable to groups.' }); return; }

    const isAdmin = conv.admins.some((a) => a.toString() === requesterId);
    if (!isAdmin && targetId !== requesterId) {
      res.status(403).json({ message: 'Only admins can remove others.' }); return;
    }

    conv.participants = conv.participants.filter((p) => p.toString() !== targetId) as any;
    conv.admins       = conv.admins.filter((a) => a.toString() !== targetId) as any;
    await conv.save();
    res.json({ message: 'Member removed.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const leaveConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conv   = await Conversation.findOne({ _id: req.params.id, participants: userId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }
    if (conv.type === 'department') {
      res.status(403).json({ message: 'You cannot leave a department group.' }); return;
    }

    conv.participants = conv.participants.filter((p) => p.toString() !== userId) as any;
    conv.admins       = conv.admins.filter((a) => a.toString() !== userId) as any;
    if (conv.type === 'group' && conv.admins.length === 0 && conv.participants.length > 0) {
      conv.admins.push(conv.participants[0]);
    }
    await conv.save();
    res.json({ message: 'Left conversation.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { isMuted, isPinned, isArchived } = req.body;

    const conv = await Conversation.findOne({ _id: req.params.id, participants: userId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }

    const patch: Record<string, boolean> = {};
    if (isMuted    !== undefined) patch.isMuted    = isMuted;
    if (isPinned   !== undefined) patch.isPinned   = isPinned;
    if (isArchived !== undefined) patch.isArchived = isArchived;

    const settings = await UserChatSettings.findOneAndUpdate(
      { user: userId, conversation: req.params.id },
      { $set: patch },
      { upsert: true, new: true },
    );
    res.json(settings);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ── Messages ──────────────────────────────────────────────────────────────────

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conv   = await Conversation.findOne({ _id: req.params.id, participants: userId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }

    const limit  = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const before = req.query.before as string;

    const filter: Record<string, any> = {
      conversation: req.params.id,
      deletedFor: { $ne: userId },
    };
    if (before) {
      const anchor = await Message.findById(before);
      if (anchor) filter.createdAt = { $lt: anchor.createdAt };
    }

    const messages = await Message.find(filter)
      .populate('sender', 'name email avatar')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar' } })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(messages.reverse());
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conv   = await Conversation.findOne({ _id: req.params.id, participants: userId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }

    const { content, type = 'text', attachments = [], replyTo } = req.body;
    if (!content?.trim() && attachments.length === 0) {
      res.status(400).json({ message: 'Message cannot be empty.' }); return;
    }

    const msg = await Message.create({
      conversation: conv._id,
      sender: userId,
      type,
      content: content?.trim() ?? '',
      attachments,
      replyTo: replyTo || undefined,
    });

    await msg.populate('sender', 'name email avatar');
    if (replyTo) {
      await msg.populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar' } });
    }

    conv.lastMessage  = msg._id as any;
    conv.lastActivity = new Date();
    await conv.save();

    res.status(201).json(msg);
  } catch (err) {
    console.error('sendMessage:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const editMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ message: 'Content required.' }); return; }

    const msg = await Message.findOne({ _id: req.params.id, sender: userId });
    if (!msg) { res.status(404).json({ message: 'Message not found.' }); return; }
    if (msg.deletedForEveryone) { res.status(400).json({ message: 'Message was deleted.' }); return; }

    msg.content  = content.trim();
    msg.isEdited = true;
    msg.editedAt = new Date();
    await msg.save();
    await msg.populate('sender', 'name email avatar');
    // Broadcast real-time edit to all conversation participants
    getIO()?.to(msg.conversation.toString()).emit('message_updated', msg);
    res.json(msg);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId      = req.user!.id;
    const forEveryone = req.query.forEveryone === 'true';

    const msg = await Message.findById(req.params.id);
    if (!msg) { res.status(404).json({ message: 'Message not found.' }); return; }

    if (forEveryone) {
      if (msg.sender.toString() !== userId) {
        res.status(403).json({ message: 'Only sender can delete for everyone.' }); return;
      }
      msg.deletedForEveryone = true;
      msg.content            = '';
      msg.attachments        = [];
    } else {
      if (!msg.deletedFor.some((d) => d.toString() === userId)) {
        msg.deletedFor.push(new mongoose.Types.ObjectId(userId));
      }
    }

    await msg.save();
    if (forEveryone) {
      // Broadcast to all participants so everyone sees the deletion instantly
      getIO()?.to(msg.conversation.toString()).emit('message_deleted', {
        messageId: req.params.id,
        conversationId: msg.conversation.toString(),
      });
    }
    res.json({ message: 'Deleted.', forEveryone });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const toggleReaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { emoji } = req.body;
    if (!emoji) { res.status(400).json({ message: 'Emoji required.' }); return; }

    const msg = await Message.findById(req.params.id);
    if (!msg) { res.status(404).json({ message: 'Message not found.' }); return; }

    const existing = msg.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      const idx = existing.users.findIndex((u) => u.toString() === userId);
      if (idx === -1) {
        existing.users.push(new mongoose.Types.ObjectId(userId));
      } else {
        existing.users.splice(idx, 1);
        if (existing.users.length === 0) {
          msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji) as any;
        }
      }
    } else {
      msg.reactions.push({ emoji, users: [new mongoose.Types.ObjectId(userId)] });
    }

    await msg.save();
    await msg.populate('sender', 'name email avatar');
    res.json(msg);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const markSeen = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conv   = await Conversation.findOne({ _id: req.params.id, participants: userId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }

    await UserChatSettings.findOneAndUpdate(
      { user: userId, conversation: req.params.id },
      { $set: { lastReadAt: new Date() } },
      { upsert: true },
    );
    res.json({ message: 'Marked as read.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ── Pin Message ───────────────────────────────────────────────────────────────

export const pinMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId  = req.user!.id;
    const convId  = req.params.id;
    const msgId   = req.params.msgId;
    const pin     = req.method === 'POST';

    const conv = await Conversation.findOne({ _id: convId, participants: userId });
    if (!conv) { res.status(404).json({ message: 'Conversation not found.' }); return; }

    if (pin) {
      if (conv.pinnedMessages.length >= 3) {
        res.status(400).json({ message: 'Maximum 3 pinned messages allowed.' });
        return;
      }
      const alreadyPinned = conv.pinnedMessages.some((p) => p.toString() === msgId);
      if (!alreadyPinned) {
        conv.pinnedMessages.push(new mongoose.Types.ObjectId(msgId));
      }
    } else {
      conv.pinnedMessages = conv.pinnedMessages.filter((p) => p.toString() !== msgId) as any;
    }

    await conv.save();

    const populated = await Conversation.findById(conv._id)
      .populate('participants', 'name email avatar role lastSeen')
      .populate({ path: 'pinnedMessages', populate: { path: 'sender', select: 'name' } });

    getIO()?.to(convId).emit('conversation_updated', populated);
    res.json(populated);
  } catch (err) {
    console.error('pinMessage:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ── Saved Messages ────────────────────────────────────────────────────────────

export const saveMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const msgId  = req.params.msgId;

    const msg = await Message.findById(msgId).populate('sender', 'name avatar');
    if (!msg) { res.status(404).json({ message: 'Message not found.' }); return; }

    const conv = await Conversation.findById(msg.conversation)
      .populate('participants', 'name');
    const convName = conv?.name ||
      (conv?.participants as any[])?.[0]?.name ||
      'Chat';

    const saved = await SavedMessage.findOneAndUpdate(
      { user: userId, messageId: msgId },
      {
        user:             userId,
        messageId:        msgId,
        conversationId:   msg.conversation,
        content:          msg.content,
        senderName:       (msg.sender as any)?.name || '',
        senderAvatar:     (msg.sender as any)?.avatar || '',
        conversationName: convName,
        savedAt:          new Date(),
      },
      { upsert: true, new: true },
    );

    res.status(201).json(saved);
  } catch (err) {
    console.error('saveMessage:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const unsaveMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const msgId  = req.params.msgId;
    await SavedMessage.deleteOne({ user: userId, messageId: msgId });
    res.json({ message: 'Unsaved.' });
  } catch (err) {
    console.error('unsaveMessage:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getSavedMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const saved  = await SavedMessage.find({ user: userId }).sort({ savedAt: -1 });
    res.json(saved);
  } catch (err) {
    console.error('getSavedMessages:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
