import { Router } from 'express';
import { getTeamMembers, getMemberWorkload, updateMemberRole } from '../controllers/team.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getTeamMembers);
router.get('/:id/workload', getMemberWorkload);
router.put('/:id/role', authorize('admin'), updateMemberRole);

export default router;
