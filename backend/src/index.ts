// Must be set before any other imports so new Date() and cron fire in IST
process.env.TZ = 'Asia/Kolkata';

import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createServer } from 'http';
import app from './app';
import connectDB from './config/db';
import { initSocket } from './socket/chatSocket';
import { startAutoCheckoutJob } from './jobs/autoCheckout';
import { startAutoAbsentJob } from './jobs/autoAbsent';
import { startLunchOvertimeJob } from './jobs/lunchOvertime';

const PORT = process.env.PORT || 4000;

const start = async () => {
  await connectDB();

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Ganesyx Backend running on port ${PORT}`);
  });

  startAutoCheckoutJob();
  startAutoAbsentJob();
  startLunchOvertimeJob();
};

start().catch(console.error);
