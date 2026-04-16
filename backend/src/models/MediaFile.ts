import mongoose, { Schema, Document, Model } from 'mongoose';

export type FileType = 'image' | 'document' | 'archive' | 'other';

export interface IMediaFile extends Document {
  project: mongoose.Types.ObjectId;
  task?: mongoose.Types.ObjectId;
  name: string;
  originalName: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  fileType: FileType;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mediaFileSchema = new Schema<IMediaFile>(
  {
    project:      { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    task:         { type: Schema.Types.ObjectId, ref: 'Task' },
    name:         { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    filename:     { type: String, required: true },
    url:          { type: String, required: true },
    mimeType:     { type: String, required: true },
    size:         { type: Number, default: 0 },
    fileType:     { type: String, enum: ['image', 'document', 'archive', 'other'], default: 'other' },
    uploadedBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

const MediaFile: Model<IMediaFile> = mongoose.model<IMediaFile>('MediaFile', mediaFileSchema);
export default MediaFile;
