import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IProjectMember {
  user: Types.ObjectId;
  role: 'lead' | 'member' | 'viewer';
}

export interface IProjectLink {
  title: string;
  url: string;
}

export interface IProject extends Document {
  title: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate: Date;
  endDate: Date;
  owner: Types.ObjectId;
  members: IProjectMember[];
  tags: string[];
  progress: number;
  thumbnail?: string;
  links: IProjectLink[];
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'archived'],
      default: 'planning',
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    endDate: { type: Date },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
      user: { type: Schema.Types.ObjectId, ref: 'User' },
      role: { type: String, enum: ['lead', 'member', 'viewer'], default: 'member' },
    }],
    tags: [{ type: String, trim: true }],
    progress: { type: Number, default: 0, min: 0, max: 100 },
    thumbnail: { type: String, default: '' },
    links: [
      {
        title: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
      },
    ],
  },
  { timestamps: true }
);

projectSchema.index({ owner: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ 'members.user': 1 });

const Project: Model<IProject> = mongoose.model<IProject>('Project', projectSchema);
export default Project;
