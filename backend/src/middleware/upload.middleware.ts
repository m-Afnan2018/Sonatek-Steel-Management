import multer from 'multer';
import path from 'path';
import fs from 'fs';

const ROOT_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure root uploads directory exists
if (!fs.existsSync(ROOT_UPLOAD_DIR)) {
  fs.mkdirSync(ROOT_UPLOAD_DIR, { recursive: true });
}

// ── MIME sets ────────────────────────────────────────────────────────────────

const IMAGE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
]);

const ALL_ALLOWED_MIME = new Set([
  ...IMAGE_MIME,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown',
  'application/zip', 'application/x-tar', 'application/gzip',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
]);

// ── Factory ───────────────────────────────────────────────────────────────────
//
// createUpload(subDir, opts) returns a configured multer instance that stores
// files under  uploads/<subDir>/  — keeping a clean folder-per-type structure
// that makes a future media library straightforward to build.
//
// Folder conventions (add more as needed):
//   usersDP          — user profile pictures
//   taskAttachments  — files attached to tasks
//   projectAssets    — project-level assets
//   (root / '')      — legacy flat uploads (backward-compatible)

export interface UploadOptions {
  /** Only allow image types (jpeg, png, webp, gif, svg) */
  imageOnly?: boolean;
  /** Max file size in MB (default: 10) */
  maxSizeMB?: number;
  /**
   * Optional custom filename function.
   * Receives (req, file) and returns the filename string.
   */
  filename?: (req: Express.Request, file: Express.Multer.File) => string;
}

export function createUpload(subDir: string, opts: UploadOptions = {}) {
  const dir = subDir
    ? path.join(ROOT_UPLOAD_DIR, subDir)
    : ROOT_UPLOAD_DIR;

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      if (opts.filename) {
        cb(null, opts.filename(req, file));
        return;
      }
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 60);
      cb(null, `${unique}-${base}${ext}`);
    },
  });

  const allowed = opts.imageOnly ? IMAGE_MIME : ALL_ALLOWED_MIME;

  const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(
        opts.imageOnly
          ? 'Only image files are allowed (jpeg, png, webp, gif, svg).'
          : `File type not allowed: ${file.mimetype}`,
      ));
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: (opts.maxSizeMB ?? 1024) * 1024 * 1024 },
  });
}

// ── Legacy default instance (flat uploads/ directory) ────────────────────────
// Kept for backward-compatibility with existing task-attachment routes.
export const upload = createUpload('');
