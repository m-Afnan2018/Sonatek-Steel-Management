import { Request, Response } from 'express';
import Attendance from '../models/Attendance';
import User from '../models/User';
import Task from '../models/Task';

async function pauseRunningTasksForUser(userId: string): Promise<void> {
  const now = new Date();
  const runningTasks = await Task.find({ assignees: userId, timerStatus: 'running' });
  for (const task of runningTasks) {
    // Calculate elapsed time up to now and add to totalElapsedSeconds
    const lastStart = [...task.timerEvents]
      .reverse()
      .find((e) => e.action === 'start' || e.action === 'resume');
    if (lastStart) {
      const elapsed = Math.floor((now.getTime() - lastStart.timestamp.getTime()) / 1000);
      task.totalElapsedSeconds = (task.totalElapsedSeconds || 0) + elapsed;
    }
    task.timerEvents.push({ action: 'pause', timestamp: now });
    task.timerStatus = 'paused';
    await task.save();
  }
}

const getToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const checkIsLate = (checkInTime: Date, threshold: string): boolean => {
  const [h, m] = threshold.split(':').map(Number);
  const limit = new Date(checkInTime);
  limit.setHours(h, m, 0, 0);
  return checkInTime > limit;
};

export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const today = getToday();
    const { workMode, notes } = req.body;

    const existing = await Attendance.findOne({ user: userId, date: today });
    if (existing && existing.checkIn) {
      res.status(400).json({ message: 'Already checked in today.' });
      return;
    }

    const user = await User.findById(userId);
    const checkInTime = new Date();
    const isLate = user?.lateThreshold ? checkIsLate(checkInTime, user.lateThreshold) : false;

    const attendance = existing || new Attendance({ user: userId, date: today });
    attendance.checkIn = checkInTime;
    attendance.workMode = workMode || 'office';
    attendance.isLate = isLate;
    attendance.status = isLate ? 'late' : (workMode === 'remote' ? 'remote' : 'present');
    if (notes) attendance.notes = [{ content: notes, documents: [], links: [], createdAt: new Date() }];

    await attendance.save();
    res.json(attendance);
  } catch (error) {
    console.error('CheckIn error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const checkOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const today = getToday();

    const attendance = await Attendance.findOne({ user: userId, date: today });
    if (!attendance || !attendance.checkIn) {
      res.status(400).json({ message: 'Not checked in today.' });
      return;
    }
    if (attendance.checkOut) {
      res.status(400).json({ message: 'Already checked out today.' });
      return;
    }

    if (attendance.lunchStart && !attendance.lunchStop) {
      attendance.lunchStop = new Date();
      const lunchMs = attendance.lunchStop.getTime() - attendance.lunchStart.getTime();
      attendance.lunchDuration = Math.round(lunchMs / (1000 * 60));
    }

    // Auto-pause any running tasks for this user
    await pauseRunningTasksForUser(userId as string);

    attendance.checkOut = new Date();
    const totalMs = attendance.checkOut.getTime() - attendance.checkIn.getTime();
    const lunchMs = (attendance.lunchDuration || 0) * 60 * 1000;
    attendance.hoursWorked = Math.round(((totalMs - lunchMs) / (1000 * 60 * 60)) * 100) / 100;
    if (attendance.hoursWorked < 4) attendance.status = 'half_day';

    await attendance.save();
    res.json(attendance);
  } catch (error) {
    console.error('CheckOut error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const lunchStart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const today = getToday();

    const attendance = await Attendance.findOne({ user: userId, date: today });
    if (!attendance || !attendance.checkIn) {
      res.status(400).json({ message: 'Not checked in today.' });
      return;
    }
    if (attendance.lunchStart) {
      res.status(400).json({ message: 'Lunch already started.' });
      return;
    }

    attendance.lunchStart = new Date();
    await attendance.save();

    // Auto-pause any running tasks for this user
    await pauseRunningTasksForUser(userId as string);

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const lunchStop = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const today = getToday();

    const attendance = await Attendance.findOne({ user: userId, date: today });
    if (!attendance || !attendance.lunchStart) {
      res.status(400).json({ message: 'Lunch not started.' });
      return;
    }
    if (attendance.lunchStop) {
      res.status(400).json({ message: 'Lunch already stopped.' });
      return;
    }

    attendance.lunchStop = new Date();
    const lunchMs = attendance.lunchStop.getTime() - attendance.lunchStart.getTime();
    attendance.lunchDuration = Math.round(lunchMs / (1000 * 60));
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getMyAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { month, year } = req.query;
    const m = month ? parseInt(month as string) - 1 : new Date().getMonth();
    const y = year ? parseInt(year as string) : new Date().getFullYear();
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59);

    const records = await Attendance.find({ user: userId, date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getUserAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;
    const m = month ? parseInt(month as string) - 1 : new Date().getMonth();
    const y = year ? parseInt(year as string) : new Date().getFullYear();
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59);

    const records = await Attendance.find({ user: userId, date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getTeamAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, userId, status } = req.query;
    const queryDate = date ? new Date(date as string) : getToday();
    const filter: Record<string, unknown> = { date: queryDate };
    if (userId) filter.user = userId;
    if (status) filter.status = status;

    const records = await Attendance.find(filter)
      .populate('user', 'name email avatar department role lateThreshold')
      .populate('approvedBy', 'name')
      .sort({ createdAt: 1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getUserAttendanceStats = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("Here I am ")
    const { userId } = req.params;
    const { month, year } = req.query;
    const m = month ? parseInt(month as string) - 1 : new Date().getMonth();
    const y = year ? parseInt(year as string) : new Date().getFullYear();
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59);

    const records = await Attendance.find({ user: userId, date: { $gte: startDate, $lte: endDate } });
    const stats = {
      totalDays: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      halfDay: records.filter((r) => r.status === 'half_day').length,
      remote: records.filter((r) => r.status === 'remote').length,
      leave: records.filter((r) => r.status === 'leave').length,
      late: records.filter((r) => r.isLate).length,
      totalHours: Math.round(records.reduce((sum, r) => sum + r.hoursWorked, 0) * 100) / 100,
      avgHours: records.length > 0 ? Math.round((records.reduce((sum, r) => sum + r.hoursWorked, 0) / records.length) * 100) / 100 : 0,
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getAttendanceStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { month, year } = req.query;
    const m = month ? parseInt(month as string) - 1 : new Date().getMonth();
    const y = year ? parseInt(year as string) : new Date().getFullYear();
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59);

    const records = await Attendance.find({ user: userId, date: { $gte: startDate, $lte: endDate } });
    const stats = {
      totalDays: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      halfDay: records.filter((r) => r.status === 'half_day').length,
      remote: records.filter((r) => r.status === 'remote').length,
      leave: records.filter((r) => r.status === 'leave').length,
      late: records.filter((r) => r.isLate).length,
      totalHours: Math.round(records.reduce((sum, r) => sum + r.hoursWorked, 0) * 100) / 100,
      avgHours: records.length > 0 ? Math.round((records.reduce((sum, r) => sum + r.hoursWorked, 0) / records.length) * 100) / 100 : 0,
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getTeamTimeline = async (req: Request, res: Response): Promise<void> => {
  try {
    const queryDate = req.query.date ? new Date(req.query.date as string) : getToday();
    const dayStart = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate(), 0, 0, 0, 0);
    const dayEnd   = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate(), 23, 59, 59, 999);

    const [users, attendances, tasks] = await Promise.all([
      User.find({ isActive: { $ne: false } }).select('name email role').lean(),
      Attendance.find({ date: { $gte: dayStart, $lte: dayEnd } }).lean(),
      Task.find({ timerEvents: { $elemMatch: { timestamp: { $gte: dayStart, $lte: dayEnd } } } })
        .select('title timerStatus timerEvents assignees')
        .populate('assignees', '_id')
        .lean(),
    ]);

    const result = users
      .map((user) => {
        const uid = (user._id as any).toString();
        const att = attendances.find((a) => a.user.toString() === uid) ?? null;

        const userTasks = tasks
          .filter((t) =>
            (t.assignees as any[]).some((a: any) => (a._id ?? a).toString() === uid)
          )
          .map((t) => ({
            _id: t._id,
            title: t.title,
            timerStatus: t.timerStatus,
            timerEvents: (t.timerEvents as any[]).filter(
              (e: any) => new Date(e.timestamp) >= dayStart && new Date(e.timestamp) <= dayEnd
            ),
          }))
          .filter((t) => t.timerEvents.length > 0);

        return {
          user: { id: uid, name: user.name, email: user.email, role: user.role },
          attendance: att
            ? {
                checkIn:    att.checkIn    ?? null,
                checkOut:   att.checkOut   ?? null,
                lunchStart: att.lunchStart ?? null,
                lunchStop:  att.lunchStop  ?? null,
                status:     att.status,
              }
            : null,
          tasks: userTasks,
        };
      })
      .filter((r) => r.attendance !== null || r.tasks.length > 0);

    res.json(result);
  } catch (error) {
    console.error('TeamTimeline error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await Attendance.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Attendance record not found.' });
      return;
    }

    const body = req.body;
    const updateData: Record<string, unknown> = { ...body, approvedBy: req.user?.id };

    // Resolve times: use incoming value if provided, else fall back to what's stored
    const checkIn    = body.checkIn    !== undefined ? (body.checkIn    ? new Date(body.checkIn)    : undefined) : existing.checkIn;
    const checkOut   = body.checkOut   !== undefined ? (body.checkOut   ? new Date(body.checkOut)   : undefined) : existing.checkOut;
    const lStart     = body.lunchStart !== undefined ? (body.lunchStart ? new Date(body.lunchStart) : undefined) : existing.lunchStart;
    const lStop      = body.lunchStop  !== undefined ? (body.lunchStop  ? new Date(body.lunchStop)  : undefined) : existing.lunchStop;

    // Recalculate lunch duration
    if (lStart && lStop) {
      updateData.lunchDuration = Math.round((lStop.getTime() - lStart.getTime()) / (1000 * 60));
    }

    // Recalculate hours worked
    if (checkIn && checkOut) {
      const totalMs  = checkOut.getTime() - checkIn.getTime();
      const lunchMs  = ((updateData.lunchDuration as number) ?? existing.lunchDuration ?? 0) * 60 * 1000;
      updateData.hoursWorked = Math.max(0, Math.round(((totalMs - lunchMs) / (1000 * 60 * 60)) * 100) / 100);
    }

    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('user', 'name email avatar');

    res.json(attendance);
  } catch (error) {
    console.error('UpdateAttendance error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const adminCreateAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, date, checkIn, checkOut, lunchStart, lunchStop, status, workMode, isLate } = req.body;
    if (!userId || !date) {
      res.status(400).json({ message: 'userId and date are required.' });
      return;
    }

    const d = new Date(date);
    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const existing = await Attendance.findOne({ user: userId, date: dateOnly });
    if (existing) {
      res.status(400).json({ message: 'Record already exists for this date. Use update instead.' });
      return;
    }

    const record = new Attendance({
      user: userId,
      date: dateOnly,
      status: status || 'present',
      workMode: workMode || 'office',
      isLate: isLate || false,
      approvedBy: req.user?.id,
    });

    if (checkIn)    record.checkIn    = new Date(checkIn);
    if (checkOut)   record.checkOut   = new Date(checkOut);
    if (lunchStart) record.lunchStart = new Date(lunchStart);
    if (lunchStop)  record.lunchStop  = new Date(lunchStop);

    if (record.lunchStart && record.lunchStop) {
      record.lunchDuration = Math.round((record.lunchStop.getTime() - record.lunchStart.getTime()) / (1000 * 60));
    }
    if (record.checkIn && record.checkOut) {
      const totalMs = record.checkOut.getTime() - record.checkIn.getTime();
      const lunchMs = (record.lunchDuration || 0) * 60 * 1000;
      record.hoursWorked = Math.max(0, Math.round(((totalMs - lunchMs) / (1000 * 60 * 60)) * 100) / 100);
    }

    await record.save();
    res.status(201).json(record);
  } catch (error) {
    console.error('AdminCreateAttendance error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addNoteToDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, documents, links, date } = req.body;
    const userId = req.user?.id;
    const targetDate = date ? new Date(date) : getToday();

    const attendance = await Attendance.findOne({ user: userId, date: targetDate });
    if (!attendance) {
      res.status(404).json({ message: 'No attendance record for this day. Check in first to add notes.' });
      return;
    }

    attendance.notes.push({ content, documents: documents || [], links: links || [], createdAt: new Date() });
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, noteIndex } = req.params;
    const userId = req.user?.id;

    const attendance = await Attendance.findOne({ _id: id, user: userId });
    if (!attendance) {
      res.status(404).json({ message: 'Attendance record not found.' });
      return;
    }

    const idx = parseInt(noteIndex);
    if (isNaN(idx) || idx < 0 || idx >= attendance.notes.length) {
      res.status(400).json({ message: 'Invalid note index.' });
      return;
    }

    attendance.notes.splice(idx, 1);
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};
