import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import MediaFile, { FileType } from '../models/MediaFile';
import Task from '../models/Task';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mimeToFileType(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) return 'image';

  const docMimes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/markdown',
  ]);
  if (docMimes.has(mimeType)) return 'document';

  const archiveMimes = new Set([
    'application/zip',
    'application/x-tar',
    'application/gzip',
  ]);
  if (archiveMimes.has(mimeType)) return 'archive';

  return 'other';
}

function isAdminOrManager(role?: string): boolean {
  return role === 'admin' || role === 'manager';
}

/**
 * Encode a task attachment as a stable string ID: "t:<taskId>:<urlBase64>"
 * This lets the frontend pass the ID back in rename/delete calls.
 */
function encodeTaskAttachmentId(taskId: string, url: string): string {
  const encodedUrl = Buffer.from(url).toString('base64url');
  return `t:${taskId}:${encodedUrl}`;
}

/**
 * Decode a task attachment ID. Returns null if the ID is not a task attachment ref.
 */
function decodeTaskAttachmentId(id: string): { taskId: string; url: string } | null {
  if (!id.startsWith('t:')) return null;
  const rest = id.slice(2); // remove "t:"
  const colonIdx = rest.indexOf(':');
  if (colonIdx === -1) return null;
  const taskId = rest.slice(0, colonIdx);
  const encodedUrl = rest.slice(colonIdx + 1);
  try {
    const url = Buffer.from(encodedUrl, 'base64url').toString();
    return { taskId, url };
  } catch {
    return null;
  }
}

/** Guess MIME type from a file URL by its extension */
function extensionToMime(url: string): string {
  const ext = path.extname(url).toLowerCase().slice(1);
  const map: Record<string, string> = {
    // images
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    bmp: 'image/bmp', ico: 'image/x-icon',
    // video
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    // audio
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
    // documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', csv: 'text/csv', md: 'text/markdown',
    // archives
    zip: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip',
  };
  return map[ext] || '';
}

/** Derive the absolute path on disk from a /uploads/... URL */
function urlToPhysicalPath(fileUrl: string): string {
  // fileUrl examples:
  //   /uploads/projectAssets/<projectId>/<filename>
  //   /uploads/<filename>   (legacy task attachments)
  const relative = fileUrl.replace(/^\//, '');
  return path.join(process.cwd(), relative);
}

function deletePhysical(filePath: string): void {
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Failed to delete physical file:', err, filePath);
    }
  });
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const getProjectMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id;

    // Fetch library docs
    const libraryDocs = await MediaFile.find({ project: projectId })
      .populate<{ uploadedBy: { _id: mongoose.Types.ObjectId; name: string } | null }>(
        'uploadedBy',
        'name',
      )
      .lean();

    // Build set of URLs already covered by library docs (for dedup)
    const libraryUrls = new Set(libraryDocs.map((d) => d.url));

    interface MediaItem {
      _id:          string;
      name:         string;
      originalName: string;
      url:          string;
      mimeType:     string;
      size:         number;
      fileType:     FileType;
      uploadedBy:   { id: mongoose.Types.ObjectId; name: string } | null;
      task:         { id: mongoose.Types.ObjectId; title?: string } | null;
      source:       'library' | 'task';
      createdAt:    Date;
    }

    // Shape library items
    const libraryItems: MediaItem[] = libraryDocs.map((doc) => ({
      _id:          (doc._id as mongoose.Types.ObjectId).toString(),
      name:         doc.name,
      originalName: doc.originalName,
      url:          doc.url,
      mimeType:     doc.mimeType,
      size:         doc.size,
      fileType:     doc.fileType,
      uploadedBy:   doc.uploadedBy
        ? { id: (doc.uploadedBy as { _id: mongoose.Types.ObjectId; name: string })._id, name: (doc.uploadedBy as { _id: mongoose.Types.ObjectId; name: string }).name }
        : null,
      task:         doc.task ? { id: doc.task } : null,
      source:       'library' as const,
      createdAt:    doc.createdAt,
    }));

    // Fetch tasks and flatten attachments
    const tasks = await Task.find({ project: projectId }).select('title attachments').lean();

    const taskItems: MediaItem[] = [];
    for (const task of tasks) {
      const taskId = (task as unknown as { _id: mongoose.Types.ObjectId })._id.toString();
      for (const att of task.attachments ?? []) {
        // Skip links
        if (att.type === 'link') continue;
        // Skip duplicates already in the library
        if (att.url && libraryUrls.has(att.url)) continue;

        const derivedMime = extensionToMime(att.url ?? '');
        const fileType: FileType = derivedMime
          ? mimeToFileType(derivedMime)
          : att.type === 'image' ? 'image' : 'document';

        taskItems.push({
          // Stable ID encoding taskId + url so rename/delete can decode it
          _id:          encodeTaskAttachmentId(taskId, att.url ?? ''),
          name:         att.name ?? '',
          originalName: att.name ?? '',
          url:          att.url ?? '',
          mimeType:     derivedMime,
          size:         0,
          fileType,
          uploadedBy:   null,
          task:         { id: (task as unknown as { _id: mongoose.Types.ObjectId })._id, title: task.title },
          source:       'task' as const,
          createdAt:    att.uploadedAt ?? new Date(0),
        });
      }
    }

    const merged = [...libraryItems, ...taskItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    res.json(merged);
  } catch (error) {
    console.error('GetProjectMedia error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file provided.' });
      return;
    }

    const projectId = req.params.id;
    const file = req.file;
    const fileType = mimeToFileType(file.mimetype);
    const url = `/uploads/projectAssets/${projectId}/${file.filename}`;

    const mediaFile = new MediaFile({
      project:      projectId,
      name:         file.originalname,
      originalName: file.originalname,
      filename:     file.filename,
      url,
      mimeType:     file.mimetype,
      size:         file.size,
      fileType,
      uploadedBy:   req.user!.id,
    });

    await mediaFile.save();
    await mediaFile.populate('uploadedBy', 'name email avatar');

    res.status(201).json(mediaFile);
  } catch (error) {
    console.error('UploadMedia error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const renameMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Name is required.' });
      return;
    }

    const fileId = req.params.fileId;
    const userId = req.user!.id;
    const userRole = req.user?.role;

    // ── Task attachment ────────────────────────────────────────────────────────
    const taskRef = decodeTaskAttachmentId(fileId);
    if (taskRef) {
      if (!isAdminOrManager(userRole)) {
        res.status(403).json({ message: 'Only admins and managers can rename task attachments.' });
        return;
      }

      const task = await Task.findById(taskRef.taskId);
      if (!task) {
        res.status(404).json({ message: 'Task not found.' });
        return;
      }

      const att = task.attachments.find((a) => a.url === taskRef.url);
      if (!att) {
        res.status(404).json({ message: 'Attachment not found in task.' });
        return;
      }

      att.name = name.trim();
      await task.save();

      res.json({
        _id:  fileId,
        name: att.name,
        url:  att.url,
      });
      return;
    }

    // ── Library file ───────────────────────────────────────────────────────────
    const mediaFile = await MediaFile.findOne({
      _id:     fileId,
      project: req.params.id,
    });

    if (!mediaFile) {
      res.status(404).json({ message: 'File not found.' });
      return;
    }

    if (!isAdminOrManager(userRole) && mediaFile.uploadedBy.toString() !== userId) {
      res.status(403).json({ message: 'You do not have permission to rename this file.' });
      return;
    }

    mediaFile.name = name.trim();
    await mediaFile.save();
    await mediaFile.populate('uploadedBy', 'name email avatar');

    res.json(mediaFile);
  } catch (error) {
    console.error('RenameMedia error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params.fileId;
    const userId = req.user!.id;
    const userRole = req.user?.role;

    // ── Task attachment ────────────────────────────────────────────────────────
    const taskRef = decodeTaskAttachmentId(fileId);
    if (taskRef) {
      if (!isAdminOrManager(userRole)) {
        res.status(403).json({ message: 'Only admins and managers can delete task attachments.' });
        return;
      }

      const task = await Task.findById(taskRef.taskId);
      if (!task) {
        res.status(404).json({ message: 'Task not found.' });
        return;
      }

      const attIndex = task.attachments.findIndex((a) => a.url === taskRef.url);
      if (attIndex === -1) {
        res.status(404).json({ message: 'Attachment not found in task.' });
        return;
      }

      // Delete physical file
      deletePhysical(urlToPhysicalPath(taskRef.url));

      // Remove from task
      task.attachments.splice(attIndex, 1);
      await task.save();

      res.json({ message: 'Attachment deleted successfully.' });
      return;
    }

    // ── Library file ───────────────────────────────────────────────────────────
    const mediaFile = await MediaFile.findOne({
      _id:     fileId,
      project: req.params.id,
    });

    if (!mediaFile) {
      res.status(404).json({ message: 'File not found.' });
      return;
    }

    if (!isAdminOrManager(userRole) && mediaFile.uploadedBy.toString() !== userId) {
      res.status(403).json({ message: 'You do not have permission to delete this file.' });
      return;
    }

    // Delete physical file
    deletePhysical(
      path.join(process.cwd(), 'uploads', 'projectAssets', req.params.id, mediaFile.filename),
    );

    await MediaFile.findByIdAndDelete(mediaFile._id);

    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error('DeleteMedia error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
