import { Request, Response } from 'express';
import User from '../models/User';
import Task from '../models/Task';

export const getTeamMembers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ isActive: true }).sort({ name: 1 });

    const membersWithTasks = await Promise.all(
      users.map(async (user) => {
        const activeTasks = await Task.countDocuments({
          assignees: user._id,
          status: { $in: ['todo', 'in_progress', 'in_review'] },
        });

        const temp =  await Task.find({
          assignees: user._id,
          status: { $in: ['todo', 'in_progress', 'in_review'] },
        });

        console.log(temp);

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          department: user.department,
          activeTasks,
        };
      })
    );

    res.json(membersWithTasks);
  } catch (error) {
    console.error('GetTeamMembers error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getMemberWorkload = async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await Task.find({
      assignees: req.params.id,
      status: { $ne: 'done' },
    })
      .populate('project', 'title')
      .sort({ priority: -1, dueDate: 1 });

    res.json(tasks);
  } catch (error) {
    console.error('GetMemberWorkload error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.body;

    if (!['admin', 'manager', 'member', 'viewer'].includes(role)) {
      res.status(400).json({ message: 'Invalid role.' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    console.error('UpdateMemberRole error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
