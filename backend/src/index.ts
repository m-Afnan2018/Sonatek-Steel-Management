import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { createServer } from 'http';
import app from './app';
import connectDB from './config/db';
import { initSocket } from './socket/chatSocket';
import { startAutoCheckoutJob } from './jobs/autoCheckout';
import { startAutoAbsentJob } from './jobs/autoAbsent';
import { startSocialSchedulerJob } from './jobs/socialScheduler';
import { startLunchOvertimeJob } from './jobs/lunchOvertime';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Ganesyx Backend running on port ${PORT}`);
  });

  startAutoCheckoutJob();
  startAutoAbsentJob();
  startSocialSchedulerJob();
  startLunchOvertimeJob();
};

start().catch(console.error);
