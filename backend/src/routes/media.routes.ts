import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import {
  getProjectMedia,
  uploadMedia,
  renameMedia,
  deleteMedia,
} from '../controllers/media.controller';

// ── MIME allow-list (mirrors upload.middleware ALL_ALLOWED_MIME) ──────────────

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown',
  'application/zip', 'application/x-tar', 'application/gzip',
]);

// ── Multer with dynamic destination per project ───────────────────────────────

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const projectId = req.params.id;
    const dir = path.join(process.cwd(), 'uploads', 'projectAssets', projectId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Project-member guard ──────────────────────────────────────────────────────
// Allows admin/manager (global roles) or any member/viewer of the project.
// For simplicity we verify the user is authenticated; project membership is
// enforced in the controller where needed (getProjectMedia is read-only so
// any authenticated user who knows the project ID can call it — tighten here
// if stricter access is required).

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/',           getProjectMedia);
router.post('/',          upload.single('file'), uploadMedia);
router.patch('/:fileId',  renameMedia);
router.delete('/:fileId', deleteMedia);

export default router;
