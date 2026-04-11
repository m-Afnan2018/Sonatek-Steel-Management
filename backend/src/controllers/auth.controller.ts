import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/User';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { name, email, password, role, department } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists with this email.' });
      return;
    }

    const user = new User({
      name,
      email,
      password,
      role: role || 'member',
      department: department || '',
    });

    await user.save();

    const tokenPayload = { id: String(user._id), email: user.email, role: user.role, name: user.name };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        department: user.department,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Account is deactivated.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const tokenPayload = { id: String(user._id), email: user.email, role: user.role, name: user.name };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        department: user.department,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await User.findOneAndUpdate({ refreshToken }, { refreshToken: '' });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout.' });
  }
};

export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    res.status(401).json({ message: 'No refresh token provided.' });
    return;
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ message: 'Invalid refresh token.' });
      return;
    }

    const tokenPayload = { id: String(user._id), email: user.email, role: user.role, name: user.name };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: newAccessToken });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      department: user.department,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, department } = req.body;
    const updates: Record<string, string> = {};
    if (name?.trim()) updates.name = name.trim();
    if (department !== undefined) updates.department = department.trim();

    const user = await User.findByIdAndUpdate(req.user?.id, updates, { new: true, runValidators: true });
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      department: user.department,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('UpdateMe error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
