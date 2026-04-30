import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IUserChatSettings extends Document {
  conversation: Types.ObjectId;
  user: Types.ObjectId;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  lastReadAt: Date;
}

const UserChatSettingsSchema = new Schema<IUserChatSettings>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isMuted:      { type: Boolean, default: false },
    isPinned:     { type: Boolean, default: false },
    isArchived:   { type: Boolean, default: false },
    lastReadAt:   { type: Date, default: () => new Date(0) },
  },
  { timestamps: false },
);

UserChatSettingsSchema.index({ user: 1, conversation: 1 }, { unique: true });

const UserChatSettings: Model<IUserChatSettings> =
  mongoose.model<IUserChatSettings>('UserChatSettings', UserChatSettingsSchema);

export default UserChatSettings;
