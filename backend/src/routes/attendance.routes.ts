import { Router } from 'express';
import {
  checkIn,
  checkOut,
  lunchStart,
  lunchStop,
  getMyAttendance,
  getTeamAttendance,
  getAttendanceStats,
  updateAttendance,
  addNoteToDate,
  deleteNote,
} from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.post('/lunch-start', lunchStart);
router.post('/lunch-stop', lunchStop);
router.get('/my', getMyAttendance);
router.get('/team', authorize('admin', 'manager'), getTeamAttendance);
router.get('/stats', getAttendanceStats);
router.put('/:id', authorize('admin'), updateAttendance);
router.post('/notes', addNoteToDate);
router.delete('/:id/notes/:noteIndex', deleteNote);

export default router;
