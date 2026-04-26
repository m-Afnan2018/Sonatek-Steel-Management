import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription';
import type { Types } from 'mongoose';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@ganesyx.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/**
 * Send a web-push notification to every registered device of a user.
 * Silently removes expired / invalid subscriptions (410 Gone).
 */
export async function sendPushToUser(
  userId: string | Types.ObjectId,
  payload: PushPayload,
): Promise<void> {
  const subs = await PushSubscription.find({ user: userId, paused: { $ne: true } });
  if (subs.length === 0) return;

  const data = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    url:   payload.url  || '/',
    icon:  payload.icon || '/icons/icon-192x192.png',
  });

  const staleIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          data,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          // Subscription has expired or is invalid — remove it
          staleIds.push(sub._id.toString());
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await PushSubscription.deleteMany({ _id: { $in: staleIds } });
  }
}
