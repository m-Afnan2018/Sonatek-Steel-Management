import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IResource extends Document {
  name: string;
  description?: string;
  category: string;
  assignedTo: Types.ObjectId;
  assignedBy: Types.ObjectId;
  serialNumber?: string;
  condition: 'new' | 'good' | 'fair' | 'damaged';
  assignedAt: Date;
  returnedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const resourceSchema = new Schema<IResource>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    category: { type: String, required: true, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    serialNumber: { type: String, trim: true },
    condition: { type: String, enum: ['new', 'good', 'fair', 'damaged'], default: 'good' },
    assignedAt: { type: Date, default: Date.now },
    returnedAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

resourceSchema.index({ assignedTo: 1 });
resourceSchema.index({ isActive: 1 });

const Resource: Model<IResource> = mongoose.model<IResource>('Resource', resourceSchema);
export default Resource;
