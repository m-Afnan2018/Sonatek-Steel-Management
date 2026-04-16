import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getProjectCalendar,
  createProjectCalendarEvent,
  updateProjectCalendarEvent,
  deleteProjectCalendarEvent,
} from '../controllers/projectCalendar.controller';

const router = Router({ mergeParams: true });
router.use(authenticate);
router.get('/', getProjectCalendar);
router.post('/', createProjectCalendarEvent);
router.put('/:eventId', updateProjectCalendarEvent);
router.delete('/:eventId', deleteProjectCalendarEvent);
export default router;
