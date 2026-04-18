import { Request, Response } from 'express';
import CalendarEvent from '../models/CalendarEvent';
import Notification from '../models/Notification';
import User from '../models/User';

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
    const { title, description, type, date, startTime, endTime, allDay, color, owner, invitees, location, recurrence, links } = req.body;
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
      links: links || [],
    });

    await event.save();
    await event.populate('owner', 'name avatar');
    await event.populate('createdBy', 'name avatar');
    await event.populate('invitees', 'name avatar');

    // Notify invitees
    const inviteeIds: string[] = invitees || [];
    if (inviteeIds.length > 0 && requesterId) {
      const creator = await User.findById(requesterId).select('name');
      const senderName = creator?.name || 'Someone';
      const eventDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const notifications = inviteeIds.map((inviteeId) => ({
        recipient: inviteeId,
        sender: requesterId,
        type: 'event_invite' as const,
        title: 'You were invited to an event',
        message: `${senderName} invited you to "${title.trim()}" on ${eventDate}`,
        link: '/attendance',
      }));
      await Notification.insertMany(notifications);
    }

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

    const { title, description, type, date, startTime, endTime, allDay, color, invitees, location, recurrence, links } = req.body;

    // Track old invitees to find newly added ones
    const oldInviteeIds = event.invitees.map((id) => id.toString());

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
    if (links !== undefined) event.links = links;

    await event.save();
    await event.populate('owner', 'name avatar');
    await event.populate('createdBy', 'name avatar');
    await event.populate('invitees', 'name avatar');

    // Notify newly added invitees
    if (invitees !== undefined && requesterId) {
      const newInviteeIds: string[] = invitees;
      const addedInvitees = newInviteeIds.filter((id) => !oldInviteeIds.includes(id));
      if (addedInvitees.length > 0) {
        const updater = await User.findById(requesterId).select('name');
        const updaterName = updater?.name || 'Someone';
        const eventDate = event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const notifications = addedInvitees.map((inviteeId) => ({
          recipient: inviteeId,
          sender: requesterId,
          type: 'event_invite' as const,
          title: 'You were invited to an event',
          message: `${updaterName} invited you to "${event.title}" on ${eventDate}`,
          link: '/attendance',
        }));
        await Notification.insertMany(notifications);
      }
    }

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
