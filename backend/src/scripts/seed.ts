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

  await User.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});
  await Attendance.deleteMany({});
  console.log('Cleared existing data');

  // ── Users ────────────────────────────────────────────────────────────
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@tracksy.com',
    password: 'Admin@1234',
    role: 'admin',
    isActive: true,
  });

  const manager = await User.create({
    name: 'Sara Ahmed',
    email: 'sara@tracksy.com',
    password: 'Sara@1234',
    role: 'manager',
    isActive: true,
  });

  const members = await Promise.all([
    User.create({ name: 'Ali Hassan',    email: 'ali@tracksy.com',    password: 'Ali@1234',    role: 'member', isActive: true }),
    User.create({ name: 'Fatima Malik',  email: 'fatima@tracksy.com', password: 'Fatima@1234', role: 'member', isActive: true }),
    User.create({ name: 'Omar Farooq',   email: 'omar@tracksy.com',   password: 'Omar@1234',   role: 'member', isActive: true }),
    User.create({ name: 'Ayesha Raza',   email: 'ayesha@tracksy.com', password: 'Ayesha@1234', role: 'member', isActive: true }),
    User.create({ name: 'Bilal Khan',    email: 'bilal@tracksy.com',  password: 'Bilal@1234',  role: 'member', isActive: true }),
  ]);

  const allUsers = [admin, manager, ...members];
  console.log(`Created ${allUsers.length} users`);

  // ── Projects ──────────────────────────────────────────────────────────
  const now = new Date();
  const projects = await Promise.all([
    Project.create({
      title: 'Client Portal Redesign',
      description: 'Full redesign of the client-facing portal with improved UX, mobile responsiveness, and a refreshed design system.',
      status: 'active',
      priority: 'high',
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endDate:   new Date(now.getFullYear(), now.getMonth() + 2, 28),
      owner: admin._id,
      members: [
        { user: manager._id,    role: 'lead'   },
        { user: members[0]._id, role: 'member' },
        { user: members[1]._id, role: 'member' },
        { user: members[2]._id, role: 'member' },
      ],
      tags: ['frontend', 'design', 'ux'],
      progress: 35,
    }),
    Project.create({
      title: 'Backend API Upgrade',
      description: 'Migrate all REST endpoints to v2 with improved error handling, rate limiting, and Swagger documentation.',
      status: 'active',
      priority: 'critical',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate:   new Date(now.getFullYear(), now.getMonth() + 1, 15),
      owner: manager._id,
      members: [
        { user: admin._id,      role: 'viewer' },
        { user: members[0]._id, role: 'lead'   },
        { user: members[2]._id, role: 'member' },
        { user: members[3]._id, role: 'member' },
      ],
      tags: ['backend', 'api', 'security'],
      progress: 60,
    }),
    Project.create({
      title: 'Mobile Application',
      description: 'Build the React Native mobile app for iOS and Android with real-time notifications and offline support.',
      status: 'planning',
      priority: 'medium',
      startDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      endDate:   new Date(now.getFullYear(), now.getMonth() + 4, 30),
      owner: admin._id,
      members: [
        { user: manager._id,    role: 'lead'   },
        { user: members[1]._id, role: 'member' },
        { user: members[4]._id, role: 'member' },
      ],
      tags: ['mobile', 'react-native', 'ios', 'android'],
      progress: 10,
    }),
  ]);
  console.log(`Created ${projects.length} projects`);

  // ── Tasks ─────────────────────────────────────────────────────────────
  const taskDefs: Array<{
    title: string;
    description: string;
    project: number;
    status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignee: number;
    estHours: number;
    elapsed: number;
    tags: string[];
  }> = [
    { title: 'Set up project scaffolding',      description: 'Initialize the project repository, CI/CD pipeline, and base folder structure.',                      project: 0, status: 'done',        priority: 'medium',   assignee: 0, estHours: 4,  elapsed: 14400,  tags: ['setup']     },
    { title: 'Design new colour system',        description: 'Define the primary, secondary, and neutral colour tokens to be used across the portal.',              project: 0, status: 'done',        priority: 'high',     assignee: 1, estHours: 6,  elapsed: 21600,  tags: ['design']    },
    { title: 'Implement authentication flow',   description: 'Build login, registration, password reset, and session management using JWT.',                        project: 0, status: 'done',        priority: 'critical', assignee: 0, estHours: 10, elapsed: 36000,  tags: ['auth']      },
    { title: 'Build dashboard layout',          description: 'Create the main dashboard with widget grid, summary cards, and quick-action bar.',                    project: 0, status: 'in_review',   priority: 'high',     assignee: 1, estHours: 8,  elapsed: 25200,  tags: ['frontend']  },
    { title: 'Responsive sidebar navigation',  description: 'Make the sidebar fully responsive and accessible on all screen sizes.',                               project: 0, status: 'in_progress', priority: 'medium',   assignee: 2, estHours: 5,  elapsed: 10800,  tags: ['frontend']  },
    { title: 'User avatar upload',              description: 'Allow users to upload and crop a profile picture, stored in S3.',                                     project: 0, status: 'todo',        priority: 'low',      assignee: 0, estHours: 3,  elapsed: 0,      tags: ['frontend']  },
    { title: 'Dark mode toggle',               description: 'Add system-preference-aware dark mode with manual override stored in user preferences.',               project: 0, status: 'todo',        priority: 'low',      assignee: 1, estHours: 4,  elapsed: 0,      tags: ['frontend']  },
    { title: 'Notifications panel',            description: 'Real-time notification drawer with read/unread states and action links.',                              project: 0, status: 'backlog',     priority: 'medium',   assignee: 2, estHours: 6,  elapsed: 0,      tags: ['frontend']  },

    { title: 'Database schema migration',      description: 'Run and verify all pending Mongoose migrations against the staging database.',                         project: 1, status: 'done',        priority: 'critical', assignee: 0, estHours: 5,  elapsed: 18000,  tags: ['backend']   },
    { title: 'API endpoint documentation',     description: 'Write Swagger/OpenAPI 3.0 specs for every v2 endpoint.',                                              project: 1, status: 'done',        priority: 'high',     assignee: 2, estHours: 8,  elapsed: 28800,  tags: ['docs']      },
    { title: 'Rate limiting middleware',       description: 'Implement per-user and per-IP rate limiting with Redis-backed counters.',                              project: 1, status: 'in_progress', priority: 'high',     assignee: 0, estHours: 6,  elapsed: 14400,  tags: ['backend']   },
    { title: 'Error handling standardisation', description: 'Centralise all error responses into a consistent JSON format with error codes.',                      project: 1, status: 'in_review',   priority: 'medium',   assignee: 2, estHours: 4,  elapsed: 12600,  tags: ['backend']   },
    { title: 'Write unit tests for auth',      description: 'Achieve ≥ 80 % code coverage for the authentication module.',                                         project: 1, status: 'todo',        priority: 'high',     assignee: 3, estHours: 10, elapsed: 0,      tags: ['testing']   },
    { title: 'Performance profiling',          description: 'Profile slow queries and add indexes; target p95 < 200 ms.',                                          project: 1, status: 'todo',        priority: 'medium',   assignee: 0, estHours: 8,  elapsed: 0,      tags: ['backend']   },
    { title: 'Security audit & fixes',         description: 'Run OWASP ZAP scan and resolve all high-severity findings.',                                          project: 1, status: 'backlog',     priority: 'critical', assignee: 3, estHours: 12, elapsed: 0,      tags: ['security']  },

    { title: 'React Native project setup',     description: 'Initialise Expo project, ESLint, Prettier, and CI pipeline for mobile.',                             project: 2, status: 'in_progress', priority: 'high',     assignee: 1, estHours: 5,  elapsed: 9000,   tags: ['mobile']    },
    { title: 'Push notification integration', description: 'Integrate Firebase Cloud Messaging for iOS and Android.',                                              project: 2, status: 'todo',        priority: 'high',     assignee: 4, estHours: 8,  elapsed: 0,      tags: ['mobile']    },
    { title: 'Offline data sync',             description: 'Implement optimistic UI updates and conflict-resolution sync when connectivity resumes.',               project: 2, status: 'backlog',     priority: 'medium',   assignee: 1, estHours: 16, elapsed: 0,      tags: ['mobile']    },
    { title: 'App store submission checklist',description: 'Prepare screenshots, descriptions, privacy policy, and age rating for App Store & Play Store.',        project: 2, status: 'backlog',     priority: 'low',      assignee: 4, estHours: 6,  elapsed: 0,      tags: ['mobile']    },
    { title: 'Biometric authentication',      description: 'Add Face ID / fingerprint login as an optional security layer.',                                       project: 2, status: 'backlog',     priority: 'medium',   assignee: 1, estHours: 10, elapsed: 0,      tags: ['mobile', 'auth'] },
  ];

  const createdTasks = await Promise.all(
    taskDefs.map((t, i) =>
      Task.create({
        title:              t.title,
        description:        t.description,
        project:            projects[t.project]._id,
        status:             t.status,
        priority:           t.priority,
        assignees:          [members[t.assignee]._id],
        reporter:           i < 8 ? manager._id : admin._id,
        dueDate:            new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7 + (i % 21)),
        estimatedHours:     t.estHours,
        totalElapsedSeconds: t.elapsed,
        tags:               t.tags,
        order:              i,
        timerStatus:        t.elapsed > 0 ? 'paused' : 'idle',
      })
    )
  );
  console.log(`Created ${createdTasks.length} tasks`);

  // Update project progress counts
  for (const project of projects) {
    const counts = await Task.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const total = counts.reduce((s, c) => s + c.count, 0);
    const done  = counts.find((c) => c._id === 'done')?.count ?? 0;
    await Project.findByIdAndUpdate(project._id, {
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
    });
  }

  // ── Attendance — last 30 weekdays ────────────────────────────────────
  const statusPool = ['present', 'present', 'present', 'present', 'remote', 'remote', 'half_day', 'absent'] as const;
  const modePool   = ['office', 'office', 'remote', 'hybrid'] as const;
  const records    = [];

  for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const user of allUsers) {
      const status   = statusPool[Math.floor(Math.random() * statusPool.length)];
      const workMode = modePool[Math.floor(Math.random() * modePool.length)];

      if (status === 'absent') {
        records.push({ user: user._id, date, status, workMode, hoursWorked: 0 });
        continue;
      }

      const checkIn = new Date(date);
      checkIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0, 0);

      const checkOut = new Date(date);
      checkOut.setHours(17 + Math.floor(Math.random() * 2), 15 + Math.floor(Math.random() * 30), 0, 0);

      const lunchStart = new Date(date);
      lunchStart.setHours(13, 0, 0, 0);
      const lunchStop = new Date(date);
      lunchStop.setHours(13, 45 + Math.floor(Math.random() * 15), 0, 0);
      const lunchDuration = Math.round((lunchStop.getTime() - lunchStart.getTime()) / 60000);

      const rawHours    = (checkOut.getTime() - checkIn.getTime()) / 3600000;
      const hoursWorked = status === 'half_day'
        ? 4
        : Math.round((rawHours - lunchDuration / 60) * 100) / 100;

      records.push({
        user: user._id,
        date,
        checkIn,
        checkOut,
        lunchStart,
        lunchStop,
        lunchDuration,
        status,
        workMode,
        hoursWorked,
        isLate: checkIn.getHours() >= 9,
      });
    }
  }

  await Attendance.insertMany(records);
  console.log(`Created ${records.length} attendance records`);

  // ── Today: live check-ins + active timers ──────────────────────────
  // Times are only inserted when they are already in the past, so the
  // seed is safe to run at any hour of the day.
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const at     = (h: number, m = 0) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0, 0);
  const past   = (d: Date) => d <= now;

  // Per-user schedule for today
  const schedules = [
    { user: admin,      ci: at(8,30),  ls: at(13, 0), le: at(13,45), mode: 'office' as const },
    { user: manager,    ci: at(8,45),  ls: at(13,15), le: at(14, 0), mode: 'office' as const },
    { user: members[0], ci: at(9, 0),  ls: at(13, 0), le: at(13,45), mode: 'office' as const }, // Ali
    { user: members[1], ci: at(8,45),  ls: at(13,15), le: at(14, 0), mode: 'remote' as const }, // Fatima
    { user: members[2], ci: at(9,15),  ls: at(13, 0), le: at(13,45), mode: 'office' as const }, // Omar
    { user: members[3], ci: at(9, 0),  ls: at(13, 0), le: at(14, 0), mode: 'remote' as const }, // Ayesha
    { user: members[4], ci: at(9,30),  ls: at(13, 0), le: at(13,45), mode: 'office' as const }, // Bilal
  ];

  const todayAtt = schedules
    .filter((s) => past(s.ci))
    .map((s) => ({
      user:          s.user._id,
      date:          today,
      checkIn:       s.ci,
      lunchStart:    past(s.ls) ? s.ls : undefined,
      lunchStop:     past(s.le) ? s.le : undefined,
      lunchDuration: past(s.le)
        ? Math.round((s.le.getTime() - s.ls.getTime()) / 60000)
        : 0,
      status:        'present'  as const,
      workMode:      s.mode,
      hoursWorked:   0,
      isLate:        s.ci.getHours() >= 9,
    }));

  if (todayAtt.length) await Attendance.insertMany(todayAtt);
  console.log(`Created ${todayAtt.length} today's attendance records`);

  // ── Timer events: historical (past days) + today ──────────────────────
  // Helper: timestamp N calendar days ago at h:m
  const dAgo = (n: number, h: number, m = 0) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - n, h, m, 0, 0);

  type Ev = { action: string; timestamp: Date };

  // Mirrors getElapsedSeconds from timerUtils — only counts CLOSED segments
  const calcElapsed = (evs: Ev[]): number => {
    let total = 0;
    let seg: Date | null = null;
    for (const e of evs) {
      if (e.action === 'start' || e.action === 'resume') {
        seg = e.timestamp;
      } else if (['pause', 'hold', 'finish'].includes(e.action) && seg) {
        total += (e.timestamp.getTime() - seg.getTime()) / 1000;
        seg = null;
      }
    }
    return Math.floor(total);
  };

  const lastStatus = (evs: Ev[]): string => {
    const last = evs[evs.length - 1]?.action;
    if (last === 'finish') return 'finished';
    if (last === 'hold')   return 'on_hold';
    if (last === 'pause')  return 'paused';
    if (last === 'start' || last === 'resume') return 'running';
    return 'idle';
  };

  // ── Historical events per task ─────────────────────────────────────────
  // Each block represents real work sessions across past days.
  // Elapsed totals are exact (verified against calcElapsed).
  //
  //  idx  Title                          Status      Target elapsed
  //   0   Set up project scaffolding     done        4h  = 14 400s
  //   1   Design new colour system       done        6h  = 21 600s
  //   2   Implement authentication flow  done        10h = 36 000s
  //   3   Build dashboard layout         in_review   7h  = 25 200s
  //   4   Responsive sidebar navigation  in_progress 3h  = 10 800s (+ today open)
  //   8   Database schema migration      done        5h  = 18 000s
  //   9   API endpoint documentation     done        8h  = 28 800s
  //  10   Rate limiting middleware        in_progress 5h  = 18 000s (+ today open)
  //  11   Error handling standardisation in_review   3.5h= 12 600s
  //  15   React Native project setup     in_progress 2h  =  7 200s (+ today open)

  const histPlans: Record<number, Ev[]> = {
    0: [                                                       // 150 + 90 = 240 min = 14 400s
      { action: 'start',  timestamp: dAgo(4,  9,  0) },
      { action: 'pause',  timestamp: dAgo(4, 11, 30) },
      { action: 'resume', timestamp: dAgo(4, 13, 30) },
      { action: 'finish', timestamp: dAgo(4, 15,  0) },
    ],
    1: [                                                       // 180 + 180 = 360 min = 21 600s
      { action: 'start',  timestamp: dAgo(6, 10,  0) },
      { action: 'pause',  timestamp: dAgo(6, 13,  0) },
      { action: 'resume', timestamp: dAgo(5,  9,  0) },
      { action: 'finish', timestamp: dAgo(5, 12,  0) },
    ],
    2: [                                                       // 240 + 270 + 90 = 600 min = 36 000s
      { action: 'start',  timestamp: dAgo(10,  9,  0) },
      { action: 'pause',  timestamp: dAgo(10, 13,  0) },
      { action: 'resume', timestamp: dAgo( 9,  9,  0) },
      { action: 'pause',  timestamp: dAgo( 9, 13, 30) },
      { action: 'resume', timestamp: dAgo( 8,  9,  0) },
      { action: 'finish', timestamp: dAgo( 8, 10, 30) },
    ],
    3: [                                                       // 180 + 120 + 120 = 420 min = 25 200s
      { action: 'start',  timestamp: dAgo(5,  9,  0) },
      { action: 'pause',  timestamp: dAgo(5, 12,  0) },
      { action: 'resume', timestamp: dAgo(4,  9,  0) },
      { action: 'pause',  timestamp: dAgo(4, 11,  0) },
      { action: 'resume', timestamp: dAgo(3, 10,  0) },
      { action: 'hold',   timestamp: dAgo(3, 12,  0) },       // waiting for design feedback
    ],
    4: [                                                       // 120 + 60 = 180 min = 10 800s
      { action: 'start',  timestamp: dAgo(2, 14,  0) },
      { action: 'pause',  timestamp: dAgo(2, 16,  0) },
      { action: 'resume', timestamp: dAgo(1,  9,  0) },
      { action: 'pause',  timestamp: dAgo(1, 10,  0) },       // today continues with resume
    ],
    8: [                                                       // 150 + 150 = 300 min = 18 000s
      { action: 'start',  timestamp: dAgo(8,  9,  0) },
      { action: 'pause',  timestamp: dAgo(8, 11, 30) },
      { action: 'resume', timestamp: dAgo(7,  9,  0) },
      { action: 'finish', timestamp: dAgo(7, 11, 30) },
    ],
    9: [                                                       // 240 + 120 + 120 = 480 min = 28 800s
      { action: 'start',  timestamp: dAgo(7,  9,  0) },
      { action: 'pause',  timestamp: dAgo(7, 13,  0) },
      { action: 'resume', timestamp: dAgo(6,  9,  0) },
      { action: 'pause',  timestamp: dAgo(6, 11,  0) },
      { action: 'resume', timestamp: dAgo(6, 14,  0) },
      { action: 'finish', timestamp: dAgo(6, 16,  0) },
    ],
    10: [                                                      // 150 + 150 = 300 min = 18 000s
      { action: 'start',  timestamp: dAgo(3, 14,  0) },
      { action: 'pause',  timestamp: dAgo(3, 16, 30) },
      { action: 'resume', timestamp: dAgo(2,  9,  0) },
      { action: 'pause',  timestamp: dAgo(2, 11, 30) },       // today continues with resume
    ],
    11: [                                                      // 120 + 90 = 210 min = 12 600s
      { action: 'start',  timestamp: dAgo(4, 10, 30) },
      { action: 'pause',  timestamp: dAgo(4, 12, 30) },
      { action: 'resume', timestamp: dAgo(3,  9, 30) },
      { action: 'hold',   timestamp: dAgo(3, 11,  0) },       // waiting for code review
    ],
    15: [                                                      // 120 min = 7 200s
      { action: 'start',  timestamp: dAgo(2, 13,  0) },
      { action: 'pause',  timestamp: dAgo(2, 15,  0) },       // today continues with resume
    ],
  };

  // ── Today's plans (appended after historical where applicable) ─────────
  // Tasks 4, 10, 15 continue from a historical pause  → first action is 'resume'
  // Tasks 12, 16 are brand-new today                  → first action is 'start'
  const todayPlans: Record<number, Array<{ action: string; h: number; m: number }>> = {
    10: [                             // Ali — Rate limiting middleware
      { action: 'resume', h: 9,  m: 30 },
      { action: 'pause',  h: 13, m:  0 },
      { action: 'resume', h: 13, m: 45 },
    ],
    4: [                              // Omar — Responsive sidebar
      { action: 'resume', h: 9,  m: 45 },
      { action: 'hold',   h: 11, m: 30 },
      { action: 'resume', h: 14, m:  0 },
    ],
    15: [                             // Fatima — React Native project setup
      { action: 'resume', h: 10, m:  0 },
      { action: 'pause',  h: 13, m: 15 },
      { action: 'resume', h: 14, m:  0 },
    ],
    12: [                             // Ayesha — Write unit tests for auth
      { action: 'start',  h: 9,  m: 30 },
      { action: 'pause',  h: 11, m:  0 },
      { action: 'resume', h: 14, m:  0 },
    ],
    16: [                             // Bilal — Push notification integration
      { action: 'start',  h: 10, m:  0 },
      { action: 'pause',  h: 12, m: 30 },
      { action: 'resume', h: 13, m: 45 },
    ],
  };

  // Apply historical-only events (tasks that are done / in_review — no today activity)
  for (const idx of [0, 1, 2, 3, 8, 9, 11]) {
    const evs = histPlans[idx];
    if (!evs) continue;
    await Task.findByIdAndUpdate(createdTasks[idx]._id, {
      timerEvents:         evs,
      timerStatus:         lastStatus(evs),
      totalElapsedSeconds: calcElapsed(evs),
    });
  }

  // Apply today's events, prepended with any historical context
  for (const [idxStr, plan] of Object.entries(todayPlans)) {
    const idx  = parseInt(idxStr);
    const task = createdTasks[idx];
    const hist = histPlans[idx] ?? [];

    const todayEvs: Ev[] = plan
      .filter((e) => past(at(e.h, e.m)))
      .map((e)    => ({ action: e.action, timestamp: at(e.h, e.m) }));

    const allEvs = [...hist, ...todayEvs];
    if (!allEvs.length) continue;

    await Task.findByIdAndUpdate(task._id, {
      timerEvents:         allEvs,
      timerStatus:         lastStatus(allEvs),
      totalElapsedSeconds: calcElapsed(allEvs),
      status:              'in_progress',
    });
  }

  console.log('Created task timer events (historical + today)');

  console.log('\n✓ Seed complete!\n');
  console.log('Credentials:');
  console.log('  Admin   : admin@tracksy.com   / Admin@1234');
  console.log('  Manager : sara@tracksy.com    / Sara@1234');
  console.log('  Member  : ali@tracksy.com     / Ali@1234');
  console.log('  Member  : fatima@tracksy.com  / Fatima@1234');
  console.log('  Member  : omar@tracksy.com    / Omar@1234');
  console.log('  Member  : ayesha@tracksy.com  / Ayesha@1234');
  console.log('  Member  : bilal@tracksy.com   / Bilal@1234');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
