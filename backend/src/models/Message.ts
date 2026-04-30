import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IReaction {
  emoji: string;
  users: Types.ObjectId[];
}

export interface ISeenEntry {
  user: Types.ObjectId;
  seenAt: Date;
}

export interface IMessageAttachment {
  name: string;
  url: string;
  type: 'image' | 'file' | 'audio';
  size?: number;
}

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  type: 'text' | 'image' | 'file' | 'audio' | 'system';
  content: string;
  attachments: IMessageAttachment[];
  replyTo?: Types.ObjectId;
  reactions: IReaction[];
  seenBy: ISeenEntry[];
  isEdited: boolean;
  editedAt?: Date;
  deletedForEveryone: boolean;
  deletedFor: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation:       { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:               { type: String, enum: ['text', 'image', 'file', 'audio', 'system'], default: 'text' },
    content:            { type: String, default: '', maxlength: 10000 },
    attachments: [
      {
        name: String,
        url:  String,
        type: { type: String, enum: ['image', 'file', 'audio'] },
        size: Number,
      },
    ],
    replyTo:            { type: Schema.Types.ObjectId, ref: 'Message' },
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      },
    ],
    seenBy: [
      {
        user:   { type: Schema.Types.ObjectId, ref: 'User' },
        seenAt: { type: Date, default: Date.now },
      },
    ],
    isEdited:           { type: Boolean, default: false },
    editedAt:           Date,
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor:         [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

MessageSchema.index({ conversation: 1, createdAt: -1 });

const Message: Model<IMessage> = mongoose.model<IMessage>('Message', MessageSchema);
export default Message;
