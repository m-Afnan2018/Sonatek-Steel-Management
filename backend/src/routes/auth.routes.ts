import { Router } from 'express';
import { body } from 'express-validator';
import { login, logout, logoutAll, refreshAccessToken, getMe, updateMe, uploadAvatar, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { createUpload } from '../middleware/upload.middleware';
import path from 'path';

// Avatar uploader: images only, 5 MB cap, stored under uploads/usersDP/
const avatarUpload = createUpload('usersDP', {
  imageOnly: true,
  maxSizeMB: 5,
  filename: (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    return `${req.user!.id}-${Date.now()}${ext}`;
  },
});

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
router.post('/logout-all', authenticate, logoutAll);
router.post('/refresh', refreshAccessToken);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.put('/me/password', authenticate, changePassword);
router.post('/me/avatar', authenticate, avatarUpload.single('avatar'), uploadAvatar);

export default router;
