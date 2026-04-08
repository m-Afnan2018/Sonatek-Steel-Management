import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import attendanceRoutes from './routes/attendance.routes';
import teamRoutes from './routes/team.routes';
import reportRoutes from './routes/report.routes';
import resourceRoutes from './routes/resource.routes';
import noteRoutes from './routes/note.routes';
import adminRoutes from './routes/admin.routes';
import calendarEventRoutes from './routes/calendarEvent.routes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { authenticate } from './middleware/auth.middleware';
import Notification from './models/Notification';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calendar-events', calendarEventRoutes);

// Notifications routes (inline)
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user?.id })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ message: 'Marked as read.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/notifications/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user?.id, isRead: false }, { isRead: true });
    res.json({ message: 'All marked as read.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
