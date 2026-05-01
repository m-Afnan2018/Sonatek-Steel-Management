import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getConversations, getOrCreateDirect, createGroup,
  getConversation, updateConversation, addMembers,
  removeMember, leaveConversation, updateSettings,
  getMessages, sendMessage, editMessage, deleteMessage,
  toggleReaction, markSeen,
  pinMessage, saveMessage, unsaveMessage, getSavedMessages,
} from '../controllers/chat.controller';

const router = Router();
router.use(authenticate);

// Static routes MUST come before /:id wildcard routes
router.get('/saved',                     getSavedMessages);
router.post('/direct',                   getOrCreateDirect);
router.post('/group',                    createGroup);
router.patch('/messages/:msgId',         editMessage);
router.delete('/messages/:msgId',        deleteMessage);
router.post('/messages/:msgId/reactions',toggleReaction);
router.post('/messages/:msgId/save',     saveMessage);
router.delete('/messages/:msgId/save',   unsaveMessage);

// Conversations — wildcard /:id after all static paths
router.get('/',                          getConversations);
router.get('/:id',                       getConversation);
router.patch('/:id',                     updateConversation);
router.post('/:id/members',             addMembers);
router.delete('/:id/members/:userId',   removeMember);
router.post('/:id/leave',               leaveConversation);
router.patch('/:id/settings',           updateSettings);
router.get('/:id/messages',             getMessages);
router.post('/:id/messages',            sendMessage);
router.post('/:id/seen',                markSeen);
router.post('/:id/pin/:msgId',          pinMessage);
router.delete('/:id/pin/:msgId',        pinMessage);

export default router;
