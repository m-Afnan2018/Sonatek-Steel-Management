import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Task from '../models/Task';
import Comment from '../models/Comment';
import Project from '../models/Project';
import Notification from '../models/Notification';

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, status, assignee, priority, search, personal } = req.query;
    const userId = req.user?.id;
    const role = req.user?.role;
    const isAdminOrManager = role === 'admin' || role === 'manager';
    const filter: Record<string, unknown> = {};

    if (personal === 'true') {
      // Personal tasks: always scoped to the requesting user
      filter.reporter = userId;
      filter.isPersonal = true;
    } else if (projectId) {
      // Project board view: scope to the project
      filter.project = projectId;
      // Members only see tasks they are assigned to within the project
      if (!isAdminOrManager) {
        filter.assignees = userId;
      }
    } else {
      // "Assigned to Me" view for members; "All Tasks" view for admin/manager
      if (!isAdminOrManager) {
        filter.assignees = userId;
        filter.isPersonal = { $ne: true };
      }
    }

    if (status) filter.status = status;
    if (assignee) filter.assignees = assignee;
    if (priority) filter.priority = priority;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const tasks = await Task.find(filter)
      .populate('assignees', 'name email avatar')
      .populate('reporter', 'name email avatar')
      .populate('project', 'title')
      .populate('activeTimerUser', 'name avatar')
      .sort({ order: 1, createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error('GetTasks error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getAllUserTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    // Admin: get all active tasks with user info for timeline
    const tasks = await Task.find({ status: { $ne: 'done' } })
      .populate('assignees', 'name email avatar')
      .populate('reporter', 'name email avatar')
      .populate('project', 'title')
      .populate('activeTimerUser', 'name avatar')
      .sort({ updatedAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignees', 'name email avatar')
      .populate('reporter', 'name email avatar')
      .populate('dependencies', 'title status')
      .populate('timeEntries.user', 'name avatar')
      .populate('activeTimerUser', 'name avatar')
      .populate('project', 'title');

    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    const comments = await Comment.find({ task: task._id })
      .populate('author', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({ ...task.toObject(), comments });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { title, description, remark, project, isPersonal, status, priority, assignees, dueDate, estimatedHours, tags, links, thumbnail } = req.body;

    const lastTask = await Task.findOne({ ...(project ? { project } : {}), status: status || 'backlog' }).sort({ order: -1 });
    const order = lastTask ? lastTask.order + 1 : 0;

    const task = new Task({
      title, description, remark,
      project: project || undefined,
      isPersonal: isPersonal || !project,
      status: status || 'backlog',
      priority: priority || 'medium',
      assignees: assignees || [],
      reporter: req.user?.id,
      dueDate, estimatedHours,
      tags: tags || [],
      links: links || [],
      thumbnail: thumbnail || '',
      order,
    });

    await task.save();
    await task.populate('assignees', 'name email avatar');
    await task.populate('reporter', 'name email avatar');

    if (assignees?.length > 0) {
      const notifications = (assignees as string[])
        .filter((a) => a !== req.user?.id)
        .map((assigneeId) => ({
          recipient: assigneeId,
          sender: req.user?.id,
          type: 'task_assigned' as const,
          title: 'New Task Assigned',
          message: `You have been assigned to "${title}"`,
          link: project ? `/projects/${project}` : '/tasks',
        }));
      if (notifications.length > 0) await Notification.insertMany(notifications);
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('CreateTask error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('assignees', 'name email avatar')
      .populate('reporter', 'name email avatar')
      .populate('project', 'title');

    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    if (task.project) {
      const taskCounts = await Task.aggregate([
        { $match: { project: task.project } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const totalTasks = taskCounts.reduce((sum, t) => sum + t.count, 0);
      const doneTasks = taskCounts.find((t) => t._id === 'done')?.count || 0;
      const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
      await Project.findByIdAndUpdate(task.project, { progress });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateTaskStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, order } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status, order: order ?? 0 },
      { new: true, runValidators: true }
    )
      .populate('assignees', 'name email avatar')
      .populate('reporter', 'name email avatar');

    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    if (task.project) {
      const taskCounts = await Task.aggregate([
        { $match: { project: task.project } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const totalTasks = taskCounts.reduce((sum, t) => sum + t.count, 0);
      const doneTasks = taskCounts.find((t) => t._id === 'done')?.count || 0;
      await Project.findByIdAndUpdate(task.project, { progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0 });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }
    await Comment.deleteMany({ task: task._id });
    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addComment = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { content, mentions } = req.body;
    const comment = new Comment({
      content,
      author: req.user?.id,
      task: req.params.id,
      mentions: mentions || [],
    });
    await comment.save();
    await comment.populate('author', 'name email avatar');

    if (mentions?.length > 0) {
      const notifications = (mentions as string[]).map((userId) => ({
        recipient: userId,
        sender: req.user?.id,
        type: 'comment_mention' as const,
        title: 'Mentioned in Comment',
        message: `${req.user?.name} mentioned you in a comment`,
        link: `/tasks`,
      }));
      await Notification.insertMany(notifications);
    }

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const logHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hours } = req.body;
    if (!hours || hours <= 0) {
      res.status(400).json({ message: 'Hours must be a positive number.' });
      return;
    }
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $inc: { loggedHours: hours } },
      { new: true }
    );
    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// Timer controls
export const startTimer = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    if (task.timerStatus === 'running') {
      res.status(400).json({ message: 'Timer already running.' });
      return;
    }

    task.timerStatus = 'running';
    task.activeTimerStart = new Date();
    task.activeTimerUser = req.user?.id as never;
    task.status = 'in_progress';

    task.timeEntries.push({
      user: req.user?.id as never,
      startTime: new Date(),
      duration: 0,
      action: 'start',
    });

    await task.save();
    await task.populate('assignees', 'name email avatar');
    await task.populate('reporter', 'name email avatar');
    await task.populate('project', 'title');
    await task.populate('activeTimerUser', 'name avatar');
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const pauseTimer = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task || task.timerStatus !== 'running') {
      res.status(400).json({ message: 'No active timer.' });
      return;
    }

    const now = new Date();
    const duration = task.activeTimerStart
      ? Math.round((now.getTime() - task.activeTimerStart.getTime()) / (1000 * 60))
      : 0;

    const lastEntry = task.timeEntries[task.timeEntries.length - 1];
    if (lastEntry) {
      lastEntry.endTime = now;
      lastEntry.duration = duration;
      lastEntry.action = 'pause';
    }

    task.timerStatus = 'paused';
    task.loggedHours = Math.round((task.loggedHours + duration / 60) * 100) / 100;
    task.activeTimerStart = undefined;

    await task.save();
    await task.populate('assignees', 'name email avatar');
    await task.populate('reporter', 'name email avatar');
    await task.populate('project', 'title');
    await task.populate('activeTimerUser', 'name avatar');
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const doneTimer = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    const now = new Date();
    if (task.timerStatus === 'running' && task.activeTimerStart) {
      const duration = Math.round((now.getTime() - task.activeTimerStart.getTime()) / (1000 * 60));
      const lastEntry = task.timeEntries[task.timeEntries.length - 1];
      if (lastEntry) {
        lastEntry.endTime = now;
        lastEntry.duration = duration;
        lastEntry.action = 'done';
      }
      task.loggedHours = Math.round((task.loggedHours + duration / 60) * 100) / 100;
    }

    task.timerStatus = 'idle';
    task.status = 'done';
    task.activeTimerStart = undefined;
    task.activeTimerUser = undefined;

    await task.save();
    await task.populate('assignees', 'name email avatar');
    await task.populate('reporter', 'name email avatar');
    await task.populate('project', 'title');
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};
