import type { ISocialAccount } from '../models/SocialAccount';
import type { ISocialPost } from '../models/SocialPost';

interface PostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

async function jsonFetch(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, options);
  let data: unknown;
  try { data = await res.json(); } catch { data = {}; }
  return { ok: res.ok, status: res.status, data };
}

async function postInstagram(account: ISocialAccount, post: ISocialPost): Promise<PostResult> {
  if (!account.igUserId) return { success: false, error: 'igUserId not configured' };

  const text = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
  const base = 'https://graph.facebook.com/v19.0';

  // Step 1: create media container
  const params = new URLSearchParams({ caption: text, access_token: account.accessToken });
  if (post.mediaUrl) params.set('image_url', post.mediaUrl);

  const create = await jsonFetch(`${base}/${account.igUserId}/media?${params}`, { method: 'POST' });
  console.log(  `${base}/${account.igUserId}/media?${params}`)
  if (!create.ok) return { success: false, error: JSON.stringify(create.data) };

  const creationId = (create.data as Record<string, unknown>).id as string;

  // Step 2: publish
  const pub = await jsonFetch(
    `${base}/${account.igUserId}/media_publish?creation_id=${creationId}&access_token=${account.accessToken}`,
    { method: 'POST' }
  );
  console.log({pub})
  if (!pub.ok) return { success: false, error: JSON.stringify(pub.data) };

  return { success: true, platformPostId: ((pub.data as Record<string, unknown>).id as string) };
}

async function postFacebook(account: ISocialAccount, post: ISocialPost): Promise<PostResult> {
  if (!account.pageId) return { success: false, error: 'pageId not configured' };

  const text = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
  const body: Record<string, string> = { message: text, access_token: account.accessToken };
  if (post.mediaUrl) body.link = post.mediaUrl;

  const res = await jsonFetch(`https://graph.facebook.com/v19.0/${account.pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return { success: false, error: JSON.stringify(res.data) };
  return { success: true, platformPostId: ((res.data as Record<string, unknown>).id as string) };
}

async function postLinkedIn(account: ISocialAccount, post: ISocialPost): Promise<PostResult> {
  if (!account.authorUrn) return { success: false, error: 'authorUrn not configured' };

  const text = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
  const body = {
    author: account.authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: post.mediaUrl ? 'IMAGE' : 'NONE',
        ...(post.mediaUrl ? {
          media: [{ status: 'READY', description: { text: '' }, originalUrl: post.mediaUrl }],
        } : {}),
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const res = await jsonFetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return { success: false, error: JSON.stringify(res.data) };
  const id = (res.data as Record<string, unknown>).id as string;
  return { success: true, platformPostId: id };
}

async function postGMB(account: ISocialAccount, post: ISocialPost): Promise<PostResult> {
  if (!account.accountId || !account.locationId) return { success: false, error: 'accountId or locationId not configured' };

  const body: Record<string, unknown> = {
    languageCode: 'en',
    summary: [post.caption, post.hashtags].filter(Boolean).join('\n\n'),
    topicType: 'STANDARD',
  };

  if (post.mediaUrl) {
    body.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.mediaUrl }];
  }

  const url = `https://mybusiness.googleapis.com/v4/accounts/${account.accountId}/locations/${account.locationId}/localPosts`;
  const res = await jsonFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return { success: false, error: JSON.stringify(res.data) };
  return { success: true, platformPostId: ((res.data as Record<string, unknown>).name as string) };
}

async function postPinterest(account: ISocialAccount, post: ISocialPost): Promise<PostResult> {
  if (!account.boardId) return { success: false, error: 'boardId not configured' };

  const body: Record<string, unknown> = {
    board_id: account.boardId,
    title: post.caption.slice(0, 100),
    description: [post.caption, post.hashtags].filter(Boolean).join('\n\n'),
  };

  if (post.mediaUrl) body.media_source = { source_type: 'image_url', url: post.mediaUrl };

  const res = await jsonFetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return { success: false, error: JSON.stringify(res.data) };
  return { success: true, platformPostId: ((res.data as Record<string, unknown>).id as string) };
}

async function postThreads(account: ISocialAccount, post: ISocialPost): Promise<PostResult> {
  if (!account.userId) return { success: false, error: 'userId not configured' };

  const text = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
  const base = 'https://graph.threads.net/v1.0';

  const createParams = new URLSearchParams({
    media_type: post.mediaUrl ? 'IMAGE' : 'TEXT',
    text,
    access_token: account.accessToken,
  });
  if (post.mediaUrl) createParams.set('image_url', post.mediaUrl);

  const create = await jsonFetch(`${base}/${account.userId}/threads?${createParams}`, { method: 'POST' });
  if (!create.ok) return { success: false, error: JSON.stringify(create.data) };

  const creationId = (create.data as Record<string, unknown>).id as string;

  const pub = await jsonFetch(
    `${base}/${account.userId}/threads_publish?creation_id=${creationId}&access_token=${account.accessToken}`,
    { method: 'POST' }
  );

  if (!pub.ok) return { success: false, error: JSON.stringify(pub.data) };
  return { success: true, platformPostId: ((pub.data as Record<string, unknown>).id as string) };
}

async function postYouTube(account: ISocialAccount, post: ISocialPost): Promise<PostResult> {
  // YouTube community posts via Data API v3
  const text = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
  const body = {
    snippet: {
      textOriginal: text,
    },
  };

  const res = await jsonFetch('https://www.googleapis.com/youtube/v3/communityPosts?part=snippet', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return { success: false, error: JSON.stringify(res.data) };
  return { success: true, platformPostId: ((res.data as Record<string, unknown>).id as string) };
}

export async function publishPost(account: ISocialAccount, post: ISocialPost): Promise<PostResult> {
  switch (post.platform) {
    case 'instagram': return postInstagram(account, post);
    case 'facebook':  return postFacebook(account, post);
    case 'linkedin':  return postLinkedIn(account, post);
    case 'gmb':       return postGMB(account, post);
    case 'pinterest': return postPinterest(account, post);
    case 'threads':   return postThreads(account, post);
    case 'youtube':   return postYouTube(account, post);
    default:          return { success: false, error: `Unknown platform: ${post.platform}` };
  }
}
