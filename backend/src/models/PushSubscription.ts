import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IPushSubscription extends Document {
  user: Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  paused: boolean;
  userAgent?: string;
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    user:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth:   { type: String, required: true },
    },
    paused:    { type: Boolean, default: false },
    userAgent: String,
  },
  { timestamps: true }
);

// One subscription per endpoint (a user can have multiple devices)
PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });
PushSubscriptionSchema.index({ user: 1 });

const PushSubscriptionModel: Model<IPushSubscription> =
  mongoose.model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);

export default PushSubscriptionModel;
