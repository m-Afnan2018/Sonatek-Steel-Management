import { Request, Response } from 'express';
import mongoose from 'mongoose';
import CalendarEvent from '../models/CalendarEvent';
import Project from '../models/Project';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAdminOrManager(role?: string): boolean {
  return role === 'admin' || role === 'manager';
}

async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const project = await Project.findById(projectId).select('owner members').lean();
  if (!project) return false;
  if (project.owner.toString() === userId) return true;
  return project.members.some((m) => m.user.toString() === userId);
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/projects/:id/calendar
 * Returns all calendar events for the project, optionally filtered by ?month=&year=
 */
export const getProjectCalendar = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;

    // Verify caller is a project member
    const member = await isProjectMember(projectId, userId);
    if (!member && !isAdminOrManager(req.user?.role)) {
      res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
      return;
    }

    const filter: Record<string, unknown> = { project: projectId };

    const { month, year } = req.query;
    if (month !== undefined && year !== undefined) {
      const m = parseInt(month as string, 10); // 1-based
      const y = parseInt(year as string, 10);
      if (!isNaN(m) && !isNaN(y)) {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1); // first day of next month (exclusive)
        filter.date = { $gte: start, $lt: end };
      }
    }

    const events = await CalendarEvent.find(filter)
      .populate('createdBy', 'name')
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.json(events);
  } catch (error) {
    console.error('GetProjectCalendar error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * POST /api/projects/:id/calendar
 * Create a new calendar event for the project.
 */
export const createProjectCalendarEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;

    // Verify project exists and caller is a member
    const member = await isProjectMember(projectId, userId);
    if (!member && !isAdminOrManager(req.user?.role)) {
      res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
      return;
    }

    const {
      title,
      date,
      description,
      note,
      type,
      startTime,
      endTime,
      allDay,
      color,
      location,
      recurrence,
      attachments,
      links,
    } = req.body as {
      title?: string;
      date?: string;
      description?: string;
      note?: string;
      type?: string;
      startTime?: string;
      endTime?: string;
      allDay?: boolean;
      color?: string;
      location?: string;
      recurrence?: string;
      attachments?: Array<{ name?: string; url: string; mimeType?: string; fileType?: string }>;
      links?: string[];
    };

    if (!title || !title.trim()) {
      res.status(400).json({ message: 'title is required.' });
      return;
    }
    if (!date) {
      res.status(400).json({ message: 'date is required.' });
      return;
    }

    const event = new CalendarEvent({
      title: title.trim(),
      date: new Date(date),
      description,
      note,
      type,
      startTime,
      endTime,
      allDay,
      color,
      location,
      recurrence,
      attachments: attachments ?? [],
      links: links ?? [],
      project: new mongoose.Types.ObjectId(projectId),
      owner: new mongoose.Types.ObjectId(userId),
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    await event.save();
    await event.populate('createdBy', 'name');

    res.status(201).json(event);
  } catch (error) {
    console.error('CreateProjectCalendarEvent error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * PUT /api/projects/:id/calendar/:eventId
 * Update a project calendar event. Only the creator or an admin/manager may edit.
 */
export const updateProjectCalendarEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId, eventId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user?.role;

    const event = await CalendarEvent.findOne({ _id: eventId, project: projectId });
    if (!event) {
      res.status(404).json({ message: 'Event not found.' });
      return;
    }

    const isCreator = event.createdBy.toString() === userId;
    if (!isCreator && !isAdminOrManager(userRole)) {
      res.status(403).json({ message: 'You do not have permission to edit this event.' });
      return;
    }

    const {
      title,
      date,
      description,
      note,
      type,
      startTime,
      endTime,
      allDay,
      color,
      location,
      recurrence,
      attachments,
      links,
    } = req.body as {
      title?: string;
      date?: string;
      description?: string;
      note?: string;
      type?: string;
      startTime?: string | null;
      endTime?: string | null;
      allDay?: boolean;
      color?: string;
      location?: string;
      recurrence?: string;
      attachments?: Array<{ name?: string; url: string; mimeType?: string; fileType?: string }>;
      links?: string[];
    };

    if (title !== undefined) event.title = title.trim();
    if (date !== undefined) event.date = new Date(date);
    if (description !== undefined) event.description = description;
    if (note !== undefined) event.note = note;
    if (type !== undefined) event.type = type as ICalendarEventType;
    if (startTime !== undefined) event.startTime = startTime ?? undefined;
    if (endTime !== undefined) event.endTime = endTime ?? undefined;
    if (allDay !== undefined) event.allDay = allDay;
    if (color !== undefined) event.color = color;
    if (location !== undefined) event.location = location;
    if (recurrence !== undefined) event.recurrence = recurrence as ICalendarEventRecurrence;
    if (attachments !== undefined) event.attachments = attachments as typeof event.attachments;
    if (links !== undefined) event.links = links;

    await event.save();
    await event.populate('createdBy', 'name');

    res.json(event);
  } catch (error) {
    console.error('UpdateProjectCalendarEvent error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * DELETE /api/projects/:id/calendar/:eventId
 * Delete a project calendar event. Only the creator or an admin/manager may delete.
 */
export const deleteProjectCalendarEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId, eventId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user?.role;

    const event = await CalendarEvent.findOne({ _id: eventId, project: projectId });
    if (!event) {
      res.status(404).json({ message: 'Event not found.' });
      return;
    }

    const isCreator = event.createdBy.toString() === userId;
    if (!isCreator && !isAdminOrManager(userRole)) {
      res.status(403).json({ message: 'You do not have permission to delete this event.' });
      return;
    }

    await CalendarEvent.findByIdAndDelete(event._id);

    res.json({ message: 'Event deleted successfully.' });
  } catch (error) {
    console.error('DeleteProjectCalendarEvent error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Local type aliases to keep cast expressions readable
type ICalendarEventType = 'meeting' | 'reminder' | 'event' | 'deadline';
type ICalendarEventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
