import { Request, Response } from 'express';
import CalendarEvent from '../models/CalendarEvent';

// GET /api/calendar-events?month=4&year=2026&userId=xxx
export const getCalendarEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year, userId } = req.query;
    const requesterId = req.user?.id;
    const role = req.user?.role;
    const isAdminOrManager = role === 'admin' || role === 'manager';

    // Build date range filter if month/year provided
    const dateFilter: Record<string, unknown> = {};
    if (month && year) {
      const m = parseInt(month as string);
      const y = parseInt(year as string);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      dateFilter.date = { $gte: start, $lte: end };
    }

    let targetUserId = requesterId;
    if (userId && isAdminOrManager) {
      // Admin/manager can view any user's calendar
      targetUserId = userId as string;
    }

    const events = await CalendarEvent.find({
      ...dateFilter,
      $or: [
        { owner: targetUserId },
        { invitees: targetUserId },
      ],
    })
      .populate('owner', 'name avatar')
      .populate('createdBy', 'name avatar')
      .populate('invitees', 'name avatar')
      .sort({ date: 1, startTime: 1 });

    res.json(events);
  } catch (error) {
    console.error('GetCalendarEvents error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/calendar-events
export const createCalendarEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, type, date, startTime, endTime, allDay, color, owner, invitees, location, recurrence } = req.body;
    const requesterId = req.user?.id;
    const role = req.user?.role;
    const isAdminOrManager = role === 'admin' || role === 'manager';

    if (!title?.trim() || !date) {
      res.status(400).json({ message: 'Title and date are required.' });
      return;
    }

    // Admin/manager can create events for any user; others can only create for themselves
    const eventOwner = isAdminOrManager && owner ? owner : requesterId;

    const event = new CalendarEvent({
      title: title.trim(),
      description: description?.trim(),
      type: type || 'event',
      date: new Date(date),
      startTime,
      endTime,
      allDay: allDay || false,
      color: color || '#6366f1',
      owner: eventOwner,
      createdBy: requesterId,
      invitees: invitees || [],
      location: location?.trim(),
      recurrence: recurrence || 'none',
    });

    await event.save();
    await event.populate('owner', 'name avatar');
    await event.populate('createdBy', 'name avatar');
    await event.populate('invitees', 'name avatar');

    res.status(201).json(event);
  } catch (error) {
    console.error('CreateCalendarEvent error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// PUT /api/calendar-events/:id
export const updateCalendarEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.id;
    const role = req.user?.role;
    const isAdminOrManager = role === 'admin' || role === 'manager';

    const event = await CalendarEvent.findById(req.params.id);
    if (!event) {
      res.status(404).json({ message: 'Event not found.' });
      return;
    }

    // Only admin/manager or the creator/owner can edit
    const canEdit = isAdminOrManager || event.createdBy.toString() === requesterId || event.owner.toString() === requesterId;
    if (!canEdit) {
      res.status(403).json({ message: 'Not authorized to edit this event.' });
      return;
    }

    const { title, description, type, date, startTime, endTime, allDay, color, invitees, location, recurrence } = req.body;

    if (title !== undefined) event.title = title.trim();
    if (description !== undefined) event.description = description?.trim();
    if (type !== undefined) event.type = type;
    if (date !== undefined) event.date = new Date(date);
    if (startTime !== undefined) event.startTime = startTime;
    if (endTime !== undefined) event.endTime = endTime;
    if (allDay !== undefined) event.allDay = allDay;
    if (color !== undefined) event.color = color;
    if (invitees !== undefined) event.invitees = invitees;
    if (location !== undefined) event.location = location?.trim();
    if (recurrence !== undefined) event.recurrence = recurrence;

    await event.save();
    await event.populate('owner', 'name avatar');
    await event.populate('createdBy', 'name avatar');
    await event.populate('invitees', 'name avatar');

    res.json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// DELETE /api/calendar-events/:id
export const deleteCalendarEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.id;
    const role = req.user?.role;
    const isAdminOrManager = role === 'admin' || role === 'manager';

    const event = await CalendarEvent.findById(req.params.id);
    if (!event) {
      res.status(404).json({ message: 'Event not found.' });
      return;
    }

    const canDelete = isAdminOrManager || event.createdBy.toString() === requesterId || event.owner.toString() === requesterId;
    if (!canDelete) {
      res.status(403).json({ message: 'Not authorized to delete this event.' });
      return;
    }

    await event.deleteOne();
    res.json({ message: 'Event deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};
