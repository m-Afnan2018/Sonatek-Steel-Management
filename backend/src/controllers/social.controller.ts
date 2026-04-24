import { Request, Response } from 'express';
import SocialAccount from '../models/SocialAccount';
import SocialPost from '../models/SocialPost';
import { publishPost } from '../utils/socialPoster';

// ── Accounts ──────────────────────────────────────────────────────────────────

export const getAccounts = async (req: Request, res: Response) => {
  const projectId = req.params.projectId || req.params.id;
  const accounts = await SocialAccount.find({ project: projectId }).sort({ platform: 1 });
  // Mask tokens before sending to client
  const masked = accounts.map((a) => ({
    ...a.toObject(),
    accessToken: a.accessToken.slice(0, 6) + '••••••••',
  }));
  res.json(masked);
};

export const createAccount = async (req: Request, res: Response) => {
  const projectId = req.params.projectId || req.params.id;
  const { platform, accountName, accessToken, igUserId, pageId, channelId, authorUrn, accountId, locationId, boardId, userId } = req.body;

  if (!platform || !accountName) {
    res.status(400).json({ message: 'platform and accountName are required' });
    return;
  }

  // Check for existing account first — token is only required when creating, not updating
  const existing = await SocialAccount.findOne({ project: projectId, platform });

  if (existing) {
    const updateFields: Record<string, unknown> = { accountName, igUserId, pageId, channelId, authorUrn, accountId, locationId, boardId, userId };
    // Only overwrite the token when the caller sends a real new one (non-empty, not a masked placeholder)
    if (accessToken && !accessToken.includes('•')) {
      updateFields.accessToken = accessToken;
    }
    const updated = await SocialAccount.findByIdAndUpdate(existing._id, updateFields, { new: true });
    const tok = updated!.accessToken;
    res.json({ ...updated!.toObject(), accessToken: tok.slice(0, 6) + '••••••••' });
    return;
  }

  // New account — token is required
  if (!accessToken) {
    res.status(400).json({ message: 'accessToken is required' });
    return;
  }

  const account = await SocialAccount.create({
    project: projectId, platform, accountName, accessToken,
    igUserId, pageId, channelId, authorUrn, accountId, locationId, boardId, userId,
    createdBy: req.user!.id,
  });

  res.status(201).json({ ...account.toObject(), accessToken: accessToken.slice(0, 6) + '••••••••' });
};

export const deleteAccount = async (req: Request, res: Response) => {
  const projectId = req.params.projectId || req.params.id;
  const { accountId } = req.params;
  await SocialAccount.findOneAndDelete({ _id: accountId, project: projectId });
  await SocialPost.deleteMany({ account: accountId });
  res.json({ message: 'Account removed' });
};

// ── Posts ─────────────────────────────────────────────────────────────────────

export const getPosts = async (req: Request, res: Response) => {
  const projectId = req.params.projectId || req.params.id;
  const { platform, status } = req.query;
  const filter: Record<string, unknown> = { project: projectId };
  if (platform) filter.platform = platform;
  if (status) filter.status = status;

  const posts = await SocialPost.find(filter)
    .populate('account', 'accountName platform')
    .sort({ scheduledAt: -1 });
  res.json(posts);
};

export const createPost = async (req: Request, res: Response) => {
  const projectId = req.params.projectId || req.params.id;
  const { accountId, platform, caption, hashtags, mediaUrl, scheduledAt, status } = req.body;

  if (!accountId || !platform || !caption || !scheduledAt) {
    res.status(400).json({ message: 'accountId, platform, caption, and scheduledAt are required' });
    return;
  }

  const account = await SocialAccount.findOne({ _id: accountId, project: projectId });
  if (!account) {
    res.status(404).json({ message: 'Social account not found' });
    return;
  }

  const post = await SocialPost.create({
    project: projectId, account: accountId, platform, caption,
    hashtags: hashtags || '', mediaUrl: mediaUrl || '',
    scheduledAt: new Date(scheduledAt),
    status: status || 'scheduled',
    createdBy: req.user!.id,
  });

  res.status(201).json(post);
};

export const updatePost = async (req: Request, res: Response) => {
  const projectId = req.params.projectId || req.params.id;
  const { postId } = req.params;
  const { caption, hashtags, mediaUrl, scheduledAt, status } = req.body;

  const post = await SocialPost.findOneAndUpdate(
    { _id: postId, project: projectId },
    { caption, hashtags, mediaUrl, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, status },
    { new: true, omitUndefined: true }
  );

  if (!post) { res.status(404).json({ message: 'Post not found' }); return; }
  res.json(post);
};

export const deletePost = async (req: Request, res: Response) => {
  const projectId = req.params.projectId || req.params.id;
  const { postId } = req.params;
  await SocialPost.findOneAndDelete({ _id: postId, project: projectId });
  res.json({ message: 'Post deleted' });
};

export const publishNow = async (req: Request, res: Response) => {
  const projectId = req.params.projectId || req.params.id;
  const { postId } = req.params;

  const post = await SocialPost.findOne({ _id: postId, project: projectId });
  if (!post) { res.status(404).json({ message: 'Post not found' }); return; }

  const account = await SocialAccount.findById(post.account);
  if (!account) { res.status(404).json({ message: 'Social account not found' }); return; }

  await SocialPost.findByIdAndUpdate(post._id, { status: 'publishing' });

  const result = await publishPost(account, post);

  console.log(result.error)

  const updated = await SocialPost.findByIdAndUpdate(
    post._id,
    {
      status: result.success ? 'published' : 'failed',
      platformPostId: result.platformPostId,
      errorMessage: result.error,
    },
    { new: true }
  );

  res.json(updated);
};
