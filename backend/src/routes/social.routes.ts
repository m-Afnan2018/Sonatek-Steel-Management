import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getAccounts, createAccount, deleteAccount,
  getPosts, createPost, updatePost, deletePost, publishNow,
} from '../controllers/social.controller';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Accounts
router.get('/accounts', getAccounts);
router.post('/accounts', createAccount);
router.delete('/accounts/:accountId', deleteAccount);

// Posts
router.get('/posts', getPosts);
router.post('/posts', createPost);
router.put('/posts/:postId', updatePost);
router.delete('/posts/:postId', deletePost);
router.post('/posts/:postId/publish-now', publishNow);

export default router;
