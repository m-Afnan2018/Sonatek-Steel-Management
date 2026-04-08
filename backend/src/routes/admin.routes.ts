import { Router } from 'express';
import { body } from 'express-validator';
import { getUsers, createUser, updateUser, deleteUser, toggleUserActive } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/users', getUsers);
router.post(
  '/users',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
  ],
  createUser
);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/toggle-active', toggleUserActive);

export default router;
