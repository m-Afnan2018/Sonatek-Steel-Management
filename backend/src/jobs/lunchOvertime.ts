import cron from 'node-cron';
import Attendance from '../models/Attendance';
import Notification from '../models/Notification';
import { createNotifications } from '../utils/createNotification';

const LUNCH_LIMIT_MS = 60 * 60 * 1000; // 1 hour in ms

/**
 * Lunch-overtime reminder job: runs every 5 minutes.
 * Finds users whose lunch break has been open for more than 1 hour
 * and sends them a single in-app notification per lunch session.
 * Guard: skips if a lunch_overtime notification was already sent today
 * for this user (prevents spam on repeated job runs).
 */
export function startLunchOvertimeJob(): void {
  cron.schedule('*/5 * * * *', async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cutoff = new Date(now.getTime() - LUNCH_LIMIT_MS);

    try {
      // Find all attendance records today where lunch has been running for > 1 hour
      const overdueRecords = await Attendance.find({
        date: { $gte: todayStart },
        lunchStart: { $lte: cutoff },
        lunchStop: null,
        checkOut: null, // user is still checked in
      });

      for (const record of overdueRecords) {
        const userId = record.user;

        // Only notify once per lunch session — check if we already sent today
        const alreadySent = await Notification.findOne({
          recipient: userId,
          type: 'lunch_overtime',
          createdAt: { $gte: todayStart },
        });

        if (alreadySent) continue;

        const elapsed = Math.floor((now.getTime() - record.lunchStart!.getTime()) / (1000 * 60));

        await createNotifications({
          recipient: userId.toString(),
          sender: userId.toString(),
          type: 'lunch_overtime',
          title: '⏰ Long Lunch Break',
          message: `Your lunch break has been running for ${elapsed} minutes. Did you forget to click Lunch Stop?`,
          link: '/attendance',
        });

        console.log(`[LunchOvertime] Notified user ${userId} — lunch open for ${elapsed} min`);
      }
    } catch (err) {
      console.error('[LunchOvertime] Error:', err);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[LunchOvertime] Scheduled: checking every 5 minutes for overtime lunch breaks.');
}
