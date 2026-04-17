import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  description: string;
  color: string;
  heads: Types.ObjectId[];
  members: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: {
      type: String,
      required: [true, 'Department name is required.'],
      trim: true,
      unique: true,
      maxlength: 100,
    },
    description: { type: String, trim: true, default: '' },
    color: { type: String, default: '#6366f1' },
    heads: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

const Department: Model<IDepartment> = mongoose.model<IDepartment>('Department', departmentSchema);
export default Department;
