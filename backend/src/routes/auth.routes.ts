import { Router } from 'express';
import { body } from 'express-validator';
import { login, logout, refreshAccessToken, getMe, updateMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public registration disabled — users are created by Admin via POST /api/admin/users

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.post('/logout', logout);
router.post('/refresh', refreshAccessToken);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);

export default router;
