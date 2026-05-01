import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface ISavedMessage extends Document {
  user: Types.ObjectId;
  messageId: Types.ObjectId;
  conversationId: Types.ObjectId;
  content: string;
  senderName: string;
  senderAvatar: string;
  conversationName: string;
  savedAt: Date;
}

const SavedMessageSchema = new Schema<ISavedMessage>(
  {
    user:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
    messageId:        { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    conversationId:   { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    content:          { type: String, default: '' },
    senderName:       { type: String, default: '' },
    senderAvatar:     { type: String, default: '' },
    conversationName: { type: String, default: '' },
    savedAt:          { type: Date, default: Date.now },
  },
  { timestamps: false },
);

SavedMessageSchema.index({ user: 1, messageId: 1 }, { unique: true });

const SavedMessage: Model<ISavedMessage> =
  mongoose.model<ISavedMessage>('SavedMessage', SavedMessageSchema);

export default SavedMessage;
