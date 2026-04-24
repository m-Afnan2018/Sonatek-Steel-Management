import mongoose, { Document, Schema, Types } from 'mongoose';
import type { SocialPlatform } from './SocialAccount';

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

export interface ISocialPost extends Document {
  project: Types.ObjectId;
  account: Types.ObjectId;
  platform: SocialPlatform;
  caption: string;
  hashtags: string;
  mediaUrl: string;
  scheduledAt: Date;
  status: PostStatus;
  errorMessage?: string;
  platformPostId?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SocialPostSchema = new Schema<ISocialPost>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    account: { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
    platform: { type: String, enum: ['instagram', 'facebook', 'youtube', 'linkedin', 'gmb', 'pinterest', 'threads'], required: true },
    caption: { type: String, required: true },
    hashtags: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'scheduled', 'publishing', 'published', 'failed'], default: 'scheduled' },
    errorMessage: String,
    platformPostId: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

SocialPostSchema.index({ project: 1, platform: 1 });
SocialPostSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model<ISocialPost>('SocialPost', SocialPostSchema);
