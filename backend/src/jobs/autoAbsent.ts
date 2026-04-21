import cron from 'node-cron';
import Attendance from '../models/Attendance';
import User from '../models/User';

/**
 * Auto-absent job: runs at 23:59 Monday–Saturday (Sunday is a holiday).
 *
 * Any active user who has NO attendance record for today gets one created
 * with status = 'absent'. Users already checked in (or manually recorded)
 * are left untouched.
 *
 * Admins can later change an absent record to 'leave' if needed.
 */
export function startAutoAbsentJob(): void {
  // "59 23 * * 1-6" = 23:59, Monday (1) through Saturday (6), every week
  cron.schedule('59 23 * * 1-6', async () => {
    console.log('[AutoAbsent] Running auto-absent job at 23:59...');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    try {
      // All active users
      const users = await User.find({ isActive: true }).select('_id');

      // Who already has a record today?
      const existing = await Attendance.find({ date: today }).select('user');
      const coveredIds = new Set(existing.map((r) => r.user.toString()));

      // Users with no record at all today
      const absentUsers = users.filter((u) => !coveredIds.has(u._id.toString()));

      if (absentUsers.length === 0) {
        console.log('[AutoAbsent] All users have records for today. Done.');
        return;
      }

      const records = absentUsers.map((u) => ({
        user: u._id,
        date: today,
        status: 'absent',
        workMode: 'office',
        hoursWorked: 0,
        lunchDuration: 0,
        isLate: false,
        notes: [],
      }));

      // ordered:false so one dupe doesn't block the rest
      await Attendance.insertMany(records, { ordered: false });

      console.log(`[AutoAbsent] Done. ${absentUsers.length} user(s) marked absent.`);
    } catch (error) {
      console.error('[AutoAbsent] Error during auto-absent job:', error);
    }
  });

  console.log('[AutoAbsent] Scheduled: auto-absent job at 23:59 Mon–Sat.');
}
