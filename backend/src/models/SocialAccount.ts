import mongoose, { Document, Schema, Types } from 'mongoose';

export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'gmb' | 'pinterest' | 'threads';

export interface ISocialAccount extends Document {
  project: Types.ObjectId;
  platform: SocialPlatform;
  accountName: string;
  accessToken: string;
  // Platform-specific identifiers
  igUserId?: string;       // Instagram
  pageId?: string;         // Facebook
  channelId?: string;      // YouTube
  authorUrn?: string;      // LinkedIn (urn:li:person:xxx or urn:li:organization:xxx)
  accountId?: string;      // GMB
  locationId?: string;     // GMB
  boardId?: string;        // Pinterest
  userId?: string;         // Threads
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SocialAccountSchema = new Schema<ISocialAccount>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    platform: { type: String, enum: ['instagram', 'facebook', 'youtube', 'linkedin', 'gmb', 'pinterest', 'threads'], required: true },
    accountName: { type: String, required: true, trim: true },
    accessToken: { type: String, required: true },
    igUserId: String,
    pageId: String,
    channelId: String,
    authorUrn: String,
    accountId: String,
    locationId: String,
    boardId: String,
    userId: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

SocialAccountSchema.index({ project: 1, platform: 1 });

export default mongoose.model<ISocialAccount>('SocialAccount', SocialAccountSchema);
