import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IConversation extends Document {
  type: 'direct' | 'group' | 'department';
  name?: string;
  description?: string;
  avatar?: string;
  participants: Types.ObjectId[];
  admins: Types.ObjectId[];
  department?: Types.ObjectId;
  createdBy: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    type:         { type: String, enum: ['direct', 'group', 'department'], required: true },
    name:         { type: String, trim: true, maxlength: 100 },
    description:  { type: String, trim: true, maxlength: 500, default: '' },
    avatar:       { type: String, default: '' },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    admins:       [{ type: Schema.Types.ObjectId, ref: 'User' }],
    department:   { type: Schema.Types.ObjectId, ref: 'Department' },
    createdBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage:  { type: Schema.Types.ObjectId, ref: 'Message' },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ConversationSchema.index({ participants: 1, lastActivity: -1 });
ConversationSchema.index({ department: 1 });

const Conversation: Model<IConversation> =
  mongoose.model<IConversation>('Conversation', ConversationSchema);

export default Conversation;
