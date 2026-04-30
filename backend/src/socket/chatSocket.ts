import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import UserChatSettings from '../models/UserChatSettings';
import mongoose from 'mongoose';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
}

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

function addOnline(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
}

function removeOnline(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

export function initSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
  });

  // JWT auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = verifyAccessToken(token);
      (socket as AuthenticatedSocket).userId   = decoded.id;
      (socket as AuthenticatedSocket).userName = decoded.name;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const s = socket as AuthenticatedSocket;
    const userId = s.userId;

    // Track online presence
    addOnline(userId, socket.id);

    // Auto-join all conversation rooms for this user
    const conversations = await Conversation.find({ participants: userId }).select('_id');
    for (const conv of conversations) {
      socket.join(conv._id.toString());
    }

    // Tell everyone else this user is now online
    socket.broadcast.emit('user_online', { userId });

    // Tell the connecting user who is already online
    socket.emit('online_users', { userIds: Array.from(onlineUsers.keys()) });

    // ── join_conversation ─────────────────────────────────────────
    socket.on('join_conversation', async (data: { conversationId: string }) => {
      const conv = await Conversation.findOne({
        _id: data.conversationId,
        participants: userId,
      });
      if (conv) socket.join(data.conversationId);
    });

    // ── send_message ──────────────────────────────────────────────
    socket.on('send_message', async (data: {
      conversationId: string;
      content: string;
      type?: string;
      attachments?: object[];
      replyTo?: string;
    }) => {
      try {
        const conv = await Conversation.findOne({
          _id: data.conversationId,
          participants: userId,
        });
        if (!conv) return;

        const msg = await Message.create({
          conversation: conv._id,
          sender: userId,
          type: data.type || 'text',
          content: data.content?.trim() ?? '',
          attachments: data.attachments || [],
          replyTo: data.replyTo || undefined,
        });

        await msg.populate('sender', 'name email avatar');
        if (data.replyTo) {
          await msg.populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar' } });
        }

        conv.lastMessage  = msg._id as any;
        conv.lastActivity = new Date();
        await conv.save();

        // Broadcast to everyone in the room (including sender for confirmation)
        io.to(data.conversationId).emit('new_message', msg);
      } catch (err) {
        console.error('[Socket] send_message error:', err);
      }
    });

    // ── typing ────────────────────────────────────────────────────
    socket.on('typing_start', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId,
        userName: s.userName,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_stopped_typing', {
        userId,
        conversationId: data.conversationId,
      });
    });

    // ── mark_seen ─────────────────────────────────────────────────
    socket.on('mark_seen', async (data: { conversationId: string }) => {
      try {
        await UserChatSettings.findOneAndUpdate(
          { user: userId, conversation: data.conversationId },
          { $set: { lastReadAt: new Date() } },
          { upsert: true },
        );
        socket.to(data.conversationId).emit('messages_seen', {
          conversationId: data.conversationId,
          userId,
          seenAt: new Date(),
        });
      } catch (err) {
        console.error('[Socket] mark_seen error:', err);
      }
    });

    // ── add_reaction ──────────────────────────────────────────────
    socket.on('add_reaction', async (data: { messageId: string; emoji: string }) => {
      try {
        const msg = await Message.findById(data.messageId);
        if (!msg) return;

        const existing = msg.reactions.find((r) => r.emoji === data.emoji);
        if (existing) {
          const idx = existing.users.findIndex((u) => u.toString() === userId);
          if (idx === -1) existing.users.push(new mongoose.Types.ObjectId(userId));
          else {
            existing.users.splice(idx, 1);
            if (existing.users.length === 0) {
              msg.reactions = msg.reactions.filter((r) => r.emoji !== data.emoji) as any;
            }
          }
        } else {
          msg.reactions.push({ emoji: data.emoji, users: [new mongoose.Types.ObjectId(userId)] });
        }

        await msg.save();
        await msg.populate('sender', 'name email avatar');

        const conv = msg.conversation.toString();
        io.to(conv).emit('message_updated', msg);
      } catch (err) {
        console.error('[Socket] add_reaction error:', err);
      }
    });

    // ── disconnect ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      removeOnline(userId, socket.id);
      const lastSeen = new Date();
      io.emit('user_offline', { userId, lastSeen });
    });
  });

  return io;
}
