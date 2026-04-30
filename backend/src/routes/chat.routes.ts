import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getConversations, getOrCreateDirect, createGroup,
  getConversation, updateConversation, addMembers,
  removeMember, leaveConversation, updateSettings,
  getMessages, sendMessage, editMessage, deleteMessage,
  toggleReaction, markSeen,
} from '../controllers/chat.controller';

const router = Router();
router.use(authenticate);

// Conversations
router.get('/',                           getConversations);
router.post('/direct',                    getOrCreateDirect);
router.post('/group',                     createGroup);
router.get('/:id',                        getConversation);
router.patch('/:id',                      updateConversation);
router.post('/:id/members',              addMembers);
router.delete('/:id/members/:userId',    removeMember);
router.post('/:id/leave',                leaveConversation);
router.patch('/:id/settings',            updateSettings);

// Messages
router.get('/:id/messages',              getMessages);
router.post('/:id/messages',             sendMessage);
router.patch('/messages/:msgId',         editMessage);
router.delete('/messages/:msgId',        deleteMessage);
router.post('/messages/:msgId/reactions',toggleReaction);
router.post('/:id/seen',                 markSeen);

export default router;
