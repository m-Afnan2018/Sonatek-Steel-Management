import cron from 'node-cron';
import Attendance from '../models/Attendance';
import Task from '../models/Task';

/**
 * Auto-checkout job: runs at 22:00 every day.
 * Finds all users still checked in (checkIn set, checkOut null) and checks them out.
 * Also auto-pauses any running tasks and stops open lunch breaks.
 */
export function startAutoCheckoutJob(): void {
  // Cron: "0 22 * * *" = every day at 22:00 IST
  cron.schedule('0 22 * * *', async () => {
    console.log('[AutoCheckout] Running auto-checkout job at 22:00...');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const checkoutTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0, 0);

    try {
      const records = await Attendance.find({
        date: today,
        checkIn: { $ne: null },
        checkOut: null,
      });

      if (records.length === 0) {
        console.log('[AutoCheckout] No users still checked in. Done.');
        return;
      }

      for (const record of records) {
        const userId = record.user.toString();

        // Auto-pause any running tasks for this user
        const runningTasks = await Task.find({ assignees: userId, timerStatus: 'running' });
        for (const task of runningTasks) {
          const lastStart = [...task.timerEvents]
            .reverse()
            .find((e) => e.action === 'start' || e.action === 'resume');
          if (lastStart) {
            const elapsed = Math.floor(
              (checkoutTime.getTime() - (lastStart.timestamp as Date).getTime()) / 1000
            );
            task.totalElapsedSeconds = (task.totalElapsedSeconds || 0) + Math.max(0, elapsed);
          }
          task.timerEvents.push({ action: 'pause', timestamp: checkoutTime });
          task.timerStatus = 'paused';
          await task.save();
        }

        // Auto-stop open lunch break
        if (record.lunchStart && !record.lunchStop) {
          record.lunchStop = checkoutTime;
          const lunchMs = record.lunchStop.getTime() - record.lunchStart.getTime();
          record.lunchDuration = Math.round(lunchMs / (1000 * 60));
        }

        // Set checkout and recalculate hours
        record.checkOut = checkoutTime;
        const totalMs = checkoutTime.getTime() - record.checkIn!.getTime();
        const lunchMs = (record.lunchDuration || 0) * 60 * 1000;
        record.hoursWorked = Math.max(
          0,
          Math.round(((totalMs - lunchMs) / (1000 * 60 * 60)) * 100) / 100
        );
        if (record.hoursWorked < 4) record.status = 'half_day';

        await record.save();
        console.log(`[AutoCheckout] User ${userId} auto-checked out. Hours: ${record.hoursWorked}`);
      }

      console.log(`[AutoCheckout] Done. ${records.length} user(s) auto-checked out.`);
    } catch (error) {
      console.error('[AutoCheckout] Error during auto-checkout job:', error);
    }
  });

  console.log('[AutoCheckout] Scheduled: auto-checkout job at 22:00 daily.');
}
