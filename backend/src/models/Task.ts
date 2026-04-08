import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAttachment {
  name: string;
  url: string;
  type: 'file' | 'image' | 'link';
  uploadedAt: Date;
}

export interface ITimeEntry {
  user: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  duration: number;
  action: 'start' | 'pause' | 'done';
}

export interface ITask extends Document {
  title: string;
  description?: string;
  remark?: string;
  project?: Types.ObjectId;
  isPersonal: boolean;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignees: Types.ObjectId[];
  reporter: Types.ObjectId;
  dueDate?: Date;
  estimatedHours?: number;
  loggedHours: number;
  tags: string[];
  dependencies: Types.ObjectId[];
  attachments: IAttachment[];
  thumbnail?: string;
  links: string[];
  order: number;
  timeEntries: ITimeEntry[];
  activeTimerStart?: Date;
  activeTimerUser?: Types.ObjectId;
  timerStatus: 'idle' | 'running' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 300 },
    description: { type: String, default: '', maxlength: 5000 },
    remark: { type: String, default: '', maxlength: 2000 },
    project: { type: Schema.Types.ObjectId, ref: 'Project' },
    isPersonal: { type: Boolean, default: false },
    status: { type: String, enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'], default: 'backlog' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    estimatedHours: { type: Number, min: 0 },
    loggedHours: { type: Number, default: 0, min: 0 },
    tags: [{ type: String, trim: true }],
    dependencies: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    attachments: [{
      name: String,
      url: String,
      type: { type: String, enum: ['file', 'image', 'link'], default: 'file' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    thumbnail: { type: String, default: '' },
    links: [{ type: String }],
    order: { type: Number, default: 0 },
    timeEntries: [{
      user: { type: Schema.Types.ObjectId, ref: 'User' },
      startTime: Date,
      endTime: Date,
      duration: { type: Number, default: 0 },
      action: { type: String, enum: ['start', 'pause', 'done'] },
    }],
    activeTimerStart: { type: Date },
    activeTimerUser: { type: Schema.Types.ObjectId, ref: 'User' },
    timerStatus: { type: String, enum: ['idle', 'running', 'paused'], default: 'idle' },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ reporter: 1 });
taskSchema.index({ isPersonal: 1 });

const Task: Model<ITask> = mongoose.model<ITask>('Task', taskSchema);
export default Task;
