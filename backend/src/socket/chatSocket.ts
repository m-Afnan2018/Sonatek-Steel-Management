import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import User from '../models/User';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import UserChatSettings from '../models/UserChatSettings';
import mongoose from 'mongoose';
import { sendPushToUser } from '../utils/webPush';

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

let ioInstance: SocketServer | null = null;
export function getIO(): SocketServer | null { return ioInstance; }

/** Make every active socket belonging to a user join a Socket.io room immediately. */
export function addUserToRoom(userId: string, roomId: string): void {
  const socketIds = onlineUsers.get(userId);
  if (!socketIds || !ioInstance) return;
  for (const socketId of socketIds) {
    const sock = ioInstance.sockets.sockets.get(socketId);
    sock?.join(roomId);
  }
}

export function initSocket(httpServer: HttpServer): SocketServer {
  // Support comma-separated origins e.g. "http://localhost:3000,https://ganesyx.dexploit.space"
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',').map((o) => o.trim());

  const io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, cb) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    },
    // Allow both WebSocket and long-polling so the connection can fall back
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware
  ioInstance = io;

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

        // Push notification to participants who are offline right now
        try {
          const preview = data.content?.trim()
            ? data.content.length > 60 ? data.content.substring(0, 60) + '…' : data.content
            : '📎 Attachment';

          const offlineParticipants = conv.participants
            .map((p) => p.toString())
            .filter((pid) => pid !== userId && !isUserOnline(pid));

          await Promise.all(
            offlineParticipants.map((pid) =>
              sendPushToUser(pid, {
                title: s.userName || 'New Message',
                body:  preview,
                url:   '/chat',
              }).catch(() => {}),
            ),
          );
        } catch {} // push failures must never break message delivery
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
        // Use io.to (not socket.to) so the sender also gets the event
        // and can update their message ticks to blue
        io.to(data.conversationId).emit('messages_seen', {
          conversationId: data.conversationId,
          userId,
          seenAt: new Date().toISOString(),
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

    // ── pin_message ───────────────────────────────────────────────
    socket.on('pin_message', async (data: { conversationId: string; messageId: string; pin: boolean }) => {
      try {
        const conv = await Conversation.findOne({
          _id: data.conversationId,
          participants: userId,
        });
        if (!conv) return;

        if (data.pin) {
          if (conv.pinnedMessages.length >= 3) return;
          const alreadyPinned = conv.pinnedMessages.some((p) => p.toString() === data.messageId);
          if (!alreadyPinned) {
            conv.pinnedMessages.push(new mongoose.Types.ObjectId(data.messageId));
          }
        } else {
          conv.pinnedMessages = conv.pinnedMessages.filter((p) => p.toString() !== data.messageId) as any;
        }

        await conv.save();

        const populated = await Conversation.findById(conv._id)
          .populate('participants', 'name email avatar role lastSeen')
          .populate({ path: 'pinnedMessages', populate: { path: 'sender', select: 'name' } });

        io.to(data.conversationId).emit('conversation_updated', populated);
      } catch (err) {
        console.error('[Socket] pin_message error:', err);
      }
    });

    // ── disconnect ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      removeOnline(userId, socket.id);
      const lastSeen = new Date();
      // Only mark offline once all tabs are closed
      if (!onlineUsers.has(userId)) {
        User.findByIdAndUpdate(userId, { lastSeen }).catch(() => {});
        io.emit('user_offline', { userId, lastSeen: lastSeen.toISOString() });
      }
    });
  });

  return io;
}
