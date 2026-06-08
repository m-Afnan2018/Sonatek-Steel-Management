import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ganesyx_pm';

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.log('Usage: npm run create-admin -- "Full Name" "email@example.com" "Password123"');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(MONGO_URI);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    existing.role = 'admin';
    existing.isActive = true;
    await existing.save();
    console.log(`Existing user "${existing.email}" promoted to admin.`);
  } else {
    const admin = await User.create({ name, email, password, role: 'admin', isActive: true });
    console.log(`Admin created: ${admin.email}`);
  }

  await mongoose.disconnect();
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to create admin:', err.message);
    process.exit(1);
  });
