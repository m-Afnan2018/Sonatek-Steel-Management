import { Request, Response } from 'express';
import Department from '../models/Department';
import User from '../models/User';

const MEMBER_SELECT = 'name email avatar role department';

export const getDepartments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const depts = await Department.find()
      .populate('head', MEMBER_SELECT)
      .populate('members', MEMBER_SELECT)
      .sort({ name: 1 });
    res.json(depts);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id)
      .populate('head', MEMBER_SELECT)
      .populate('members', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, color, headId } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: 'Department name is required.' });
      return;
    }
    const exists = await Department.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
    if (exists) {
      res.status(409).json({ message: 'A department with this name already exists.' });
      return;
    }
    const dept = await Department.create({
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#6366f1',
      head: headId || null,
      members: headId ? [headId] : [],
    });
    if (headId) {
      await User.findByIdAndUpdate(headId, { department: name.trim() });
    }
    await dept.populate('head', MEMBER_SELECT);
    await dept.populate('members', MEMBER_SELECT);
    res.status(201).json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, color, headId } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description.trim();
    if (color !== undefined) patch.color = color;
    if (headId !== undefined) patch.head = headId || null;

    const dept = await Department.findByIdAndUpdate(req.params.id, patch, { new: true })
      .populate('head', MEMBER_SELECT)
      .populate('members', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    // Sync department name on all members if name changed
    if (name !== undefined) {
      await User.updateMany(
        { _id: { $in: dept.members.map((m) => (m as any)._id) } },
        { department: dept.name }
      );
    }
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }
    await User.updateMany({ _id: { $in: dept.members } }, { department: '' });
    await dept.deleteOne();
    res.json({ message: 'Department deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: 'userId is required.' }); return; }
    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: userId } },
      { new: true }
    ).populate('head', MEMBER_SELECT).populate('members', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    await User.findByIdAndUpdate(userId, { department: dept.name });
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await Department.findById(req.params.id);
    if (!existing) { res.status(404).json({ message: 'Department not found.' }); return; }

    const wasHead = existing.head && existing.head.toString() === req.params.userId;

    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { $pull: { members: req.params.userId } },
      { new: true }
    ).populate('head', MEMBER_SELECT).populate('members', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    if (wasHead) {
      await Department.findByIdAndUpdate(req.params.id, { $unset: { head: 1 } });
      dept.head = undefined;
    }
    await User.findByIdAndUpdate(req.params.userId, { department: '' });
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const setHead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    // userId must be a member
    if (userId && !dept.members.map((m) => m.toString()).includes(userId)) {
      res.status(400).json({ message: 'User must be a member of this department to be set as head.' });
      return;
    }
    dept.head = userId || null;
    await dept.save();
    await dept.populate('head', MEMBER_SELECT);
    await dept.populate('members', MEMBER_SELECT);
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};
