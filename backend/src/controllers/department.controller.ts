import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Department from '../models/Department';
import User from '../models/User';

const MEMBER_SELECT = 'name email avatar role department';

/** Recompute user.department as a comma-separated list of all dept names
 *  the user currently belongs to. Called after any membership change. */
async function syncUserDepts(userId: string | mongoose.Types.ObjectId): Promise<void> {
  const depts = await Department.find({ members: userId }).select('name').sort({ name: 1 });
  const names = depts.map((d) => d.name).join(', ');
  await User.findByIdAndUpdate(userId, { department: names });
}

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
      await syncUserDepts(headId);
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

    // Recompute department string for all members when name changes
    if (name !== undefined) {
      const memberIds = dept.members.map((m) => (m as any)._id ?? m);
      await Promise.all(memberIds.map((id) => syncUserDepts(id)));
    }
    res.json(dept);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id);
    console.log(dept)
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }
    const memberIds = [...dept.members];
    await dept.deleteOne();
    // Recompute each member's department string (this dept is now gone)
    await Promise.all(memberIds.map((id) => syncUserDepts(id)));
    res.json({ message: 'Department deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: 'userId is required.' }); return; }

    let uid: mongoose.Types.ObjectId;
    try { uid = new mongoose.Types.ObjectId(userId); } catch {
      res.status(400).json({ message: 'Invalid userId.' }); return;
    }

    const user = await User.findById(uid);
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: uid } },
      { new: true }
    ).populate('head', MEMBER_SELECT).populate('members', MEMBER_SELECT);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    await syncUserDepts(uid);
    res.json(dept);
  } catch (err) {
    console.error('addMember error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404).json({ message: 'Department not found.' }); return; }

    const userIdStr = req.params.userId;

    // Filter out the member using string comparison (avoids ObjectId casting issues)
    const before = dept.members.length;
    dept.members = dept.members.filter((m) => m.toString() !== userIdStr) as typeof dept.members;

    if (dept.members.length === before) {
      res.status(404).json({ message: 'User is not a member of this department.' });
      return;
    }

    // Clear head if the removed user was the head
    if (dept.head && dept.head.toString() === userIdStr) {
      dept.head = undefined;
    }

    await dept.save();

    const populated = await Department.findById(dept._id)
      .populate('head', MEMBER_SELECT)
      .populate('members', MEMBER_SELECT);

    await syncUserDepts(userIdStr);

    res.json(populated);
  } catch (err) {
    console.error('removeMember error:', err);
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
