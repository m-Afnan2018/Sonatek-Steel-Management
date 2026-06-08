/**
 * reset.ts
 * Wipes ALL data from every collection, then re-creates:
 *   - One admin account  (admin@ganesyx.com)
 *   - 13 real member accounts, each with a unique strong password
 *
 * Run:  npx ts-node -r tsconfig-paths/register src/scripts/reset.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Task from '../models/Task';
import Attendance from '../models/Attendance';
import Department from '../models/Department';
import Comment from '../models/Comment';
import Notification from '../models/Notification';
import Note from '../models/Note';
import CalendarEvent from '../models/CalendarEvent';
import Resource from '../models/Resource';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ganesyx_pm';

const MEMBER_EMAILS: string[] = [
  'obesh.khan316608@gmail.com',
  'sandhyadigitalmarketer240@gmail.com',
  'pald82092@gmail.com',
  'imdigitalabhishek@gmail.com',
  'm.afnan2018@gmail.com',
  'dilnawazwebstudio@gmail.com',
  'imtiazhamzah0311@gmail.com',
  'gargtushar4775@gmail.com',
  'info.ganesyx@gmail.com',
  'suh6raj@gmail.com',
  'panwarshobhit55@gmail.com',
  'hs3547454@gmail.com',
  'divyanshuchaudhary0008@gmail.com',
];

const UPPER  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I/O confusion
const LOWER  = 'abcdefghjkmnpqrstuvwxyz';    // no i/l confusion
const DIGITS = '23456789';                    // no 0/1 confusion
const SYMS   = '@#$%&*!';

/** Generate a random strong password: 4 upper + 4 lower + 3 digit + 2 symbol, shuffled */
function generatePassword(): string {
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[crypto.randomInt(set.length)]);

  const chars = [
    ...pick(UPPER, 4),
    ...pick(LOWER, 4),
    ...pick(DIGITS, 3),
    ...pick(SYMS, 2),
  ];

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/** Derive a display name from an email address.
 *  e.g. "m.afnan2018@gmail.com" → "M Afnan" */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0];
  const clean = local.replace(/[0-9_]+$/, '').replace(/[._]/g, ' ');
  return clean
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim() || local;
}

const reset = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  // ── Wipe every collection ─────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    Attendance.deleteMany({}),
    Department.deleteMany({}),
    Comment.deleteMany({}),
    Notification.deleteMany({}),
    Note.deleteMany({}),
    CalendarEvent.deleteMany({}),
    Resource.deleteMany({}),
  ]);
  console.log('✓ Cleared all collections\n');

  const SALT_ROUNDS = 12;

  // ── Admin account ─────────────────────────────────────────────────
  const ADMIN_PASSWORD = 'Tracksy@Admin2025!';
  await User.collection.insertOne({
    name: 'Admin',
    email: 'admin@ganesyx.com',
    password: await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS),
    role: 'admin',
    isActive: true,
    avatar: '',
    lateThreshold: '09:30',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // ── Member accounts with individual passwords ─────────────────────
  const credentials: { email: string; password: string }[] = MEMBER_EMAILS.map((email) => ({
    email,
    password: generatePassword(),
  }));

  // Hash all passwords in parallel, then bulk-insert (bypasses pre-save hook — no double-hash)
  const memberDocs = await Promise.all(
    credentials.map(async ({ email, password }) => ({
      name: nameFromEmail(email),
      email,
      password: await bcrypt.hash(password, SALT_ROUNDS),
      role: 'member',
      isActive: true,
      department: '',
      avatar: '',
      lateThreshold: '09:30',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  );

  await User.collection.insertMany(memberDocs);

  // ── Print credentials table ───────────────────────────────────────
  const COL = 42;
  const line = '─'.repeat(COL + 20);
  console.log(line);
  console.log('RESET COMPLETE — save these credentials now');
  console.log(line);
  console.log(`${'EMAIL'.padEnd(COL)}PASSWORD`);
  console.log(line);
  console.log(`${'admin@ganesyx.com'.padEnd(COL)}${ADMIN_PASSWORD}`);
  console.log('');
  for (const { email, password } of credentials) {
    console.log(`${email.padEnd(COL)}${password}`);
  }
  console.log(line);

  await mongoose.disconnect();
  process.exit(0);
};

reset().catch((err) => {
  console.error('Reset error:', err);
  process.exit(1);
});
