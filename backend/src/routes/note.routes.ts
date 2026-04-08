import { Router } from 'express';
import { getNotes, createNote, updateNote, deleteNote, pinNote } from '../controllers/note.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getNotes);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);
router.post('/:id/pin', pinNote);

export default router;
