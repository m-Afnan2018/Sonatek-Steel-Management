import { Request, Response } from 'express';
import Task from '../models/Task';
import Attendance from '../models/Attendance';

export const getBurndown = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await Task.find({ isPersonal: { $ne: true } });
    const totalTasks = tasks.length;

    // Generate daily burndown for last 30 days
    const days = 30;
    const data = [];
    const now = new Date();

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(23, 59, 59, 999);

      const completedByDate = tasks.filter(
        (t) => t.status === 'done' && t.updatedAt <= date
      ).length;

      const remaining = totalTasks - completedByDate;
      const ideal = Math.round(totalTasks - (totalTasks / days) * (days - i));

      data.push({
        date: date.toISOString().split('T')[0],
        remaining: Math.max(0, remaining),
        ideal: Math.max(0, ideal),
      });
    }

    res.json({ totalTasks, data });
  } catch (error) {
    console.error('GetBurndown error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getVelocity = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Velocity: tasks completed per week for last 8 weeks
    const weeks = 8;
    const data = [];
    const now = new Date();

    for (let i = weeks; i > 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i - 1) * 7);
      weekEnd.setHours(23, 59, 59, 999);

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const completed = await Task.countDocuments({
        status: 'done',
        updatedAt: { $gte: weekStart, $lte: weekEnd },
      });

      data.push({
        week: `W${weeks - i + 1}`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        completed,
      });
    }

    res.json(data);
  } catch (error) {
    console.error('GetVelocity error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getAttendanceSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    const m = month ? parseInt(month as string) - 1 : new Date().getMonth();
    const y = year ? parseInt(year as string) : new Date().getFullYear();

    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59);

    const stats = await Attendance.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgHours: { $avg: '$hoursWorked' },
        },
      },
    ]);

    // Daily breakdown for chart
    const dailyData = await Attendance.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present: {
            $sum: { $cond: [{ $in: ['$status', ['present', 'remote']] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] },
          },
          leave: {
            $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      summary: stats.reduce((acc, s) => ({ ...acc, [s._id]: { count: s.count, avgHours: Math.round(s.avgHours * 100) / 100 } }), {}),
      daily: dailyData.map((d) => ({
        date: d._id,
        present: d.present,
        absent: d.absent,
        leave: d.leave,
      })),
    });
  } catch (error) {
    console.error('GetAttendanceSummary error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
