import { Router } from 'express';
import { getBurndown, getVelocity, getAttendanceSummary } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/burndown', getBurndown);
router.get('/velocity', getVelocity);
router.get('/attendance-summary', getAttendanceSummary);

export default router;
