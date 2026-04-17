import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Project from '../models/Project';
import Task from '../models/Task';

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, priority, search } = req.query;
    const userId = req.user?.id;

    const filter: Record<string, unknown> = {
      $or: [
        { owner: userId },
        { 'members.user': userId },
      ],
      status: { $ne: 'archived' },
    };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$and = [{ title: { $regex: search, $options: 'i' } }];
    }

    const projects = await Project.find(filter)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .sort({ updatedAt: -1 });

    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const taskCounts = await Task.aggregate([
          { $match: { project: project._id } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const totalTasks = taskCounts.reduce((sum, t) => sum + t.count, 0);
        const doneTasks = taskCounts.find((t) => t._id === 'done')?.count || 0;
        const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        return {
          ...project.toObject(),
          progress,
          taskCounts: taskCounts.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
          totalTasks,
        };
      })
    );

    res.json(projectsWithCounts);
  } catch (error) {
    console.error('GetProjects error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar role department')
      .populate('members.user', 'name email avatar role department');

    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const taskCounts = await Task.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const totalTasks = taskCounts.reduce((sum, t) => sum + t.count, 0);
    const doneTasks = taskCounts.find((t) => t._id === 'done')?.count || 0;

    res.json({
      ...project.toObject(),
      progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      taskCounts: taskCounts.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
      totalTasks,
    });
  } catch (error) {
    console.error('GetProject error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { title, description, status, priority, startDate, endDate, members, tags } = req.body;

    const project = new Project({
      title,
      description,
      status: status || 'planning',
      priority: priority || 'medium',
      startDate,
      endDate,
      owner: req.user?.id,
      members: members || [],
      tags: tags || [],
    });

    await project.save();
    await project.populate('owner', 'name email avatar');
    await project.populate('members.user', 'name email avatar');

    res.status(201).json(project);
  } catch (error) {
    console.error('CreateProject error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const uploadThumbnail = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded.' });
      return;
    }
    const thumbnailUrl = `/uploads/projectThumbnails/${req.file.filename}`;
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { thumbnail: thumbnailUrl },
      { new: true }
    )
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar');

    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }
    res.json({ thumbnail: thumbnailUrl, project });
  } catch (error) {
    console.error('UploadThumbnail error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar');

    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('UpdateProject error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status: 'archived' },
      { new: true }
    );

    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    res.json({ message: 'Project archived successfully.' });
  } catch (error) {
    console.error('DeleteProject error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const alreadyMember = project.members.some((m) => m.user.toString() === userId);
    if (alreadyMember) {
      res.status(400).json({ message: 'User is already a member.' });
      return;
    }

    project.members.push({ user: userId, role: role || 'member' });
    await project.save();
    await project.populate('members.user', 'name email avatar');

    res.json(project);
  } catch (error) {
    console.error('AddMember error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    project.members = project.members.filter(
      (m) => m.user.toString() !== req.params.userId
    );
    await project.save();

    res.json({ message: 'Member removed successfully.' });
  } catch (error) {
    console.error('RemoveMember error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
