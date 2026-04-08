import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface INote extends Document {
  title: string;
  content: string;
  owner: Types.ObjectId;
  color?: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>(
  {
    title: { type: String, default: 'Untitled Note', maxlength: 200 },
    content: { type: String, default: '', maxlength: 10000 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    color: { type: String, default: '' },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

noteSchema.index({ owner: 1, updatedAt: -1 });

const Note: Model<INote> = mongoose.model<INote>('Note', noteSchema);
export default Note;
