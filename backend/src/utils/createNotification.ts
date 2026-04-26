import Notification from '../models/Notification';
import { sendPushToUser } from './webPush';
import type { INotification } from '../models/Notification';

export type NotifPayload = {
  recipient: string;
  sender: string;
  type: INotification['type'];
  title: string;
  message: string;
  link?: string;
};

/**
 * Create one or more in-app notifications AND fire a web-push to each recipient.
 * Drop-in replacement for Notification.create / Notification.insertMany.
 */
export async function createNotifications(payloads: NotifPayload | NotifPayload[]): Promise<void> {
  const arr = Array.isArray(payloads) ? payloads : [payloads];
  if (arr.length === 0) return;

  await Notification.insertMany(arr.map((p) => ({ ...p, isRead: false })));

  for (const p of arr) {
    sendPushToUser(p.recipient, {
      title: p.title,
      body:  p.message,
      url:   p.link || '/',
    }).catch(() => {});
  }
}
