import cron from 'node-cron';
import SocialPost from '../models/SocialPost';
import SocialAccount from '../models/SocialAccount';
import { publishPost } from '../utils/socialPoster';

export function startSocialSchedulerJob() {
  // Run every minute, check for posts due to be published
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const duePosts = await SocialPost.find({
        status: 'scheduled',
        scheduledAt: { $lte: now },
      });

      for (const post of duePosts) {
        // Mark as publishing to prevent double-firing
        await SocialPost.findByIdAndUpdate(post._id, { status: 'publishing' });

        try {
          const account = await SocialAccount.findById(post.account);
          if (!account) {
            await SocialPost.findByIdAndUpdate(post._id, { status: 'failed', errorMessage: 'Social account not found' });
            continue;
          }

          const result = await publishPost(account, post);

          await SocialPost.findByIdAndUpdate(post._id, {
            status: result.success ? 'published' : 'failed',
            platformPostId: result.platformPostId,
            errorMessage: result.error,
          });

          if (result.success) {
            console.log(`[Social] Published ${post.platform} post ${post._id}`);
          } else {
            console.error(`[Social] Failed ${post.platform} post ${post._id}: ${result.error}`);
          }
        } catch (err) {
          await SocialPost.findByIdAndUpdate(post._id, {
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    } catch (err) {
      console.error('[Social Scheduler] Error:', err);
    }
  });

  console.log('[Social Scheduler] Started — checking every minute');
}
