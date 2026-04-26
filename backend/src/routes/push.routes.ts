import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import PushSubscription from '../models/PushSubscription';
import { sendPushToUser } from '../utils/webPush';

const router = Router();

// Return the VAPID public key so the browser can subscribe
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Save / update a push subscription
router.post('/subscribe', authenticate, async (req: Request, res: Response) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ message: 'Invalid subscription object.' });
    return;
  }

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      user: req.user!.id,
      endpoint,
      keys,
      userAgent: req.headers['user-agent']?.slice(0, 200),
    },
    { upsert: true, new: true },
  );

  res.status(201).json({ message: 'Subscribed.' });
});

// Remove a subscription (user unsubscribes on this device)
router.post('/unsubscribe', authenticate, async (req: Request, res: Response) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await PushSubscription.deleteOne({ endpoint, user: req.user!.id });
  }
  res.json({ message: 'Unsubscribed.' });
});

// Dev helper — send a test push to the current user
router.post('/test', authenticate, async (req: Request, res: Response) => {
  await sendPushToUser(req.user!.id, {
    title: '🔔 Test Notification',
    body:  'Web Push is working correctly!',
    url:   '/dashboard',
  });
  res.json({ message: 'Test push sent.' });
});

export default router;
