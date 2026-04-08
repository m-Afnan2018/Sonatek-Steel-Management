import { Router } from 'express';
import {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  returnResource,
} from '../controllers/resource.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getResources);
router.get('/:id', getResource);
router.post('/', authorize('admin', 'manager'), createResource);
router.put('/:id', authorize('admin', 'manager'), updateResource);
router.delete('/:id', authorize('admin'), deleteResource);
router.post('/:id/return', authorize('admin', 'manager'), returnResource);

export default router;
