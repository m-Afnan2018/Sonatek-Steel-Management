import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User';
import Project from '../models/Project';
import Task from '../models/Task';
import Attendance from '../models/Attendance';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ganesyx_pm';

const seed = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});
  await Attendance.deleteMany({});
  console.log('Cleared existing data');

  // Create users
  const admin = await User.create({
    name: 'Alex Admin',
    email: 'admin@ganesyx.com',
    password: 'password123',
    role: 'admin',
    department: 'Engineering',
    isActive: true,
  });

  const manager1 = await User.create({
    name: 'Maya Manager',
    email: 'maya@ganesyx.com',
    password: 'password123',
    role: 'manager',
    department: 'Engineering',
    isActive: true,
  });

  const manager2 = await User.create({
    name: 'Marcus Manager',
    email: 'marcus@ganesyx.com',
    password: 'password123',
    role: 'manager',
    department: 'Design',
    isActive: true,
  });

  const members = await Promise.all([
    User.create({ name: 'Sarah Dev', email: 'sarah@ganesyx.com', password: 'password123', role: 'member', department: 'Engineering' }),
    User.create({ name: 'James Dev', email: 'james@ganesyx.com', password: 'password123', role: 'member', department: 'Engineering' }),
    User.create({ name: 'Emily Designer', email: 'emily@ganesyx.com', password: 'password123', role: 'member', department: 'Design' }),
    User.create({ name: 'David QA', email: 'david@ganesyx.com', password: 'password123', role: 'member', department: 'QA' }),
    User.create({ name: 'Lisa PM', email: 'lisa@ganesyx.com', password: 'password123', role: 'member', department: 'Product' }),
  ]);

  const allUsers = [admin, manager1, manager2, ...members];
  console.log(`Created ${allUsers.length} users`);

  // Create projects
  const now = new Date();
  const projects = await Promise.all([
    Project.create({
      title: 'GaneSyx Platform Redesign',
      description: 'Complete redesign of the main platform with new design system and improved UX flows.',
      status: 'active',
      priority: 'high',
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 2, 28),
      owner: admin._id,
      members: [
        { user: manager1._id, role: 'lead' },
        { user: members[0]._id, role: 'member' },
        { user: members[1]._id, role: 'member' },
        { user: members[2]._id, role: 'member' },
      ],
      tags: ['frontend', 'design', 'ux'],
    }),
    Project.create({
      title: 'API v2 Migration',
      description: 'Migrate all endpoints to v2 with improved error handling and documentation.',
      status: 'active',
      priority: 'critical',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 15),
      owner: manager1._id,
      members: [
        { user: admin._id, role: 'viewer' },
        { user: members[0]._id, role: 'lead' },
        { user: members[1]._id, role: 'member' },
        { user: members[3]._id, role: 'member' },
      ],
      tags: ['backend', 'api', 'migration'],
    }),
    Project.create({
      title: 'Mobile App Development',
      description: 'Build a React Native mobile app for the GaneSyx platform with push notifications.',
      status: 'planning',
      priority: 'medium',
      startDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 4, 30),
      owner: manager2._id,
      members: [
        { user: members[0]._id, role: 'member' },
        { user: members[2]._id, role: 'lead' },
        { user: members[4]._id, role: 'member' },
      ],
      tags: ['mobile', 'react-native', 'app'],
    }),
  ]);
  console.log(`Created ${projects.length} projects`);

  // Create tasks
  const statuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
  const priorities = ['low', 'medium', 'high', 'critical'] as const;
  const taskTitles = [
    'Set up project scaffolding', 'Design new color system', 'Implement auth flow',
    'Create dashboard layout', 'Build Kanban board', 'API endpoint testing',
    'Database schema migration', 'User avatar upload', 'Notification system',
    'Search functionality', 'Performance optimization', 'Write unit tests',
    'Code review process', 'Deploy staging environment', 'Update documentation',
    'Fix login redirect bug', 'Responsive sidebar', 'Dark mode toggle',
    'Export reports feature', 'Team workload chart',
  ];

  const tasks = [];
  for (let i = 0; i < 20; i++) {
    const projectIndex = i % 3;
    const statusIndex = Math.min(Math.floor(i / 4), 4);
    const assigneeIndex = i % members.length;

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 30));

    tasks.push(
      Task.create({
        title: taskTitles[i],
        description: `Detailed description for: ${taskTitles[i]}. This task involves multiple steps and requires coordination with the team.`,
        project: projects[projectIndex]._id,
        status: statuses[statusIndex],
        priority: priorities[i % 4],
        assignees: [members[assigneeIndex]._id],
        reporter: i < 10 ? manager1._id : manager2._id,
        dueDate,
        estimatedHours: Math.floor(Math.random() * 20) + 2,
        loggedHours: Math.floor(Math.random() * 10),
        tags: [['frontend', 'backend', 'design', 'testing', 'devops'][i % 5]],
        order: i,
      })
    );
  }
  await Promise.all(tasks);
  console.log(`Created ${taskTitles.length} tasks`);

  // Create attendance records for last 30 days
  const attendanceRecords = [];
  const attendanceStatuses = ['present', 'present', 'present', 'present', 'remote', 'half_day', 'absent', 'leave'] as const;
  const workModes = ['office', 'remote', 'hybrid'] as const;

  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const user of allUsers) {
      const statusIdx = Math.floor(Math.random() * attendanceStatuses.length);
      const status = attendanceStatuses[statusIdx];
      const workMode = workModes[Math.floor(Math.random() * 3)];

      const checkIn = new Date(date);
      checkIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));

      const checkOut = new Date(date);
      checkOut.setHours(16 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60));

      const hoursWorked = status === 'absent' || status === 'leave'
        ? 0
        : status === 'half_day'
          ? 4
          : Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100;

      attendanceRecords.push({
        user: user._id,
        date,
        checkIn: status !== 'absent' && status !== 'leave' ? checkIn : undefined,
        checkOut: status !== 'absent' && status !== 'leave' ? checkOut : undefined,
        status,
        workMode,
        hoursWorked,
      });
    }
  }

  await Attendance.insertMany(attendanceRecords);
  console.log(`Created ${attendanceRecords.length} attendance records`);

  console.log('\nSeed complete!');
  console.log('Login credentials:');
  console.log('  Admin: admin@ganesyx.com / password123');
  console.log('  Manager: maya@ganesyx.com / password123');
  console.log('  Member: sarah@ganesyx.com / password123');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
