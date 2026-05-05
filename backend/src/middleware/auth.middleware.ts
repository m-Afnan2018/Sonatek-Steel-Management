import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import User from '../models/User';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Access denied. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);

    // Verify tokenVersion — instantly rejects tokens from signed-out-everywhere sessions
    const user = await User.findById(decoded.id).select('+tokenVersion');
    if (!user || user.tokenVersion !== (decoded.tokenVersion ?? 0)) {
      res.status(401).json({ message: 'Session expired. Please log in again.' });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
