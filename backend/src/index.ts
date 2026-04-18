import dotenv from 'dotenv';
import path from 'path';
// In development, load from project root .env; in Docker env vars are injected by docker-compose
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback: load .env from cwd if the above path didn't exist

import app from './app';
import connectDB from './config/db';
import { startAutoCheckoutJob } from './jobs/autoCheckout';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Ganesyx Backend running on port ${PORT}`);
  });

  startAutoCheckoutJob();
};

start().catch(console.error);
