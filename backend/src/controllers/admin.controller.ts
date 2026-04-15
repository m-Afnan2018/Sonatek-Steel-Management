import { Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, lateThreshold } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use.' });

    const user = await User.create({ name, email, password, role, lateThreshold });
    const userObj = user.toObject() as unknown as Record<string, unknown>;
    delete userObj.password;
    res.status(201).json(userObj);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    res.status(400).json({ message: msg });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { password, ...updates } = req.body;
    if (password) {
      const salt = await bcrypt.genSalt(12);
      (updates as Record<string, unknown>).password = await bcrypt.hash(password, salt);
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    res.status(400).json({ message: msg });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    if (req.params.id === req.user?.id) return res.status(400).json({ message: 'Cannot delete yourself.' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const toggleUserActive = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.isActive = !user.isActive;
    await user.save();
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};
