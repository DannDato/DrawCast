import logger from '../helpers/winston.js';

const PREVIEW_TTL_MS = 60_000;
const YOUTUBE_PREVIEW_TTL_MS = 180_000;
const FETCH_TIMEOUT_MS = 4_000;

const previewCache = new Map();
const tokenCache = {
  twitch: { token: '', expiresAt: 0 },
  kick: { token: '', expiresAt: 0 }
};

function parseChannelUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return { platform: 'web', slug: '', url: null };

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try { url = new URL(candidate); } catch { return { platform: 'web', slug: '', url: null }; }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) {
    return { platform: 'twitch', slug: String(parts[0] || '').toLowerCase(), url };
  }

  if (host === 'kick.com' || host.endsWith('.kick.com')) {
    return { platform: 'kick', slug: String(parts[0] || '').toLowerCase(), url };
  }

  if (host === 'youtu.be') {
    return { platform: 'youtube', videoId: String(parts[0] || ''), handle: '', channelId: '', url };
  }

  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const first = String(parts[0] || '');
    const second = String(parts[1] || '');
    const videoId = url.searchParams.get('v') || (first === 'live' || first === 'shorts' ? second : '');
    const handle = first.startsWith('@') ? first.slice(1) : '';
    const channelId = first === 'channel' ? second : '';
    return { platform: 'youtube', videoId, handle, channelId, url };
  }

  return { platform: 'web', slug: String(parts[0] || ''), url };
}

async function fetchJson(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function cacheGet(key) {
  const entry = previewCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    previewCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttl = PREVIEW_TTL_MS) {
  previewCache.set(key, { value, expiresAt: Date.now() + ttl });
  if (previewCache.size > 200) {
    const firstKey = previewCache.keys().next().value;
    if (firstKey) previewCache.delete(firstKey);
  }
  return value;
}

async function getTwitchAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID || '';
  const clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;

  if (tokenCache.twitch.token && tokenCache.twitch.expiresAt > Date.now() + 60_000) {
    return { token: tokenCache.twitch.token, clientId };
  }

  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' });
  const data = await fetchJson(`https://id.twitch.tv/oauth2/token?${params.toString()}`, { method: 'POST' });
  if (!data?.access_token) throw new Error('Twitch app token missing');

  tokenCache.twitch = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000
  };
  return { token: tokenCache.twitch.token, clientId };
}

async function twitchPreview(parsed) {
  if (!parsed.slug) return { platform: 'twitch', status: 'unknown', embeddable: true };
  const auth = await getTwitchAppToken();
  if (!auth) return { platform: 'twitch', status: 'unknown', embeddable: true, reason: 'not_configured' };

  const url = new URL('https://api.twitch.tv/helix/streams');
  url.searchParams.set('user_login', parsed.slug);
  const data = await fetchJson(url, {
    headers: {
      'Client-Id': auth.clientId,
      Authorization: `Bearer ${auth.token}`
    }
  });

  const stream = data?.data?.[0] || null;
  if (!stream) {
    const userUrl = new URL('https://api.twitch.tv/helix/users');
    userUrl.searchParams.set('login', parsed.slug);
    const userData = await fetchJson(userUrl, {
      headers: {
        'Client-Id': auth.clientId,
        Authorization: `Bearer ${auth.token}`
      }
    });
    const user = userData?.data?.[0] || null;
    return {
      platform: 'twitch',
      status: 'offline',
      embeddable: true,
      displayName: user?.display_name || parsed.slug,
      thumbnailUrl: user?.profile_image_url || null
    };
  }

  return {
    platform: 'twitch',
    status: 'live',
    embeddable: true,
    displayName: stream.user_name || parsed.slug,
    title: stream.title || '',
    category: stream.game_name || '',
    viewerCount: Number(stream.viewer_count || 0),
    startedAt: stream.started_at || null,
    thumbnailUrl: String(stream.thumbnail_url || '').replace('{width}', '1280').replace('{height}', '720') || null
  };
}

async function getKickAppToken() {
  const clientId = process.env.KICK_CLIENT_ID || '';
  const clientSecret = process.env.KICK_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;

  if (tokenCache.kick.token && tokenCache.kick.expiresAt > Date.now() + 60_000) return tokenCache.kick.token;

  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const data = await fetchJson('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!data?.access_token) throw new Error('Kick app token missing');

  tokenCache.kick = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000
  };
  return tokenCache.kick.token;
}

async function kickPreview(parsed) {
  if (!parsed.slug) return { platform: 'kick', status: 'unknown', embeddable: true };
  const token = await getKickAppToken();
  if (!token) return { platform: 'kick', status: 'unknown', embeddable: true, reason: 'not_configured' };

  const url = new URL('https://api.kick.com/public/v1/channels');
  url.searchParams.append('slug', parsed.slug);
  const data = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
  const channel = data?.data?.[0] || null;
  if (!channel) return { platform: 'kick', status: 'unknown', embeddable: true };

  const stream = channel.stream || null;
  if (!stream?.is_live) {
    return {
      platform: 'kick',
      status: 'offline',
      embeddable: true,
      displayName: channel.slug || parsed.slug,
      title: channel.stream_title || '',
      category: channel.category?.name || '',
      thumbnailUrl: channel.banner_picture || null
    };
  }

  return {
    platform: 'kick',
    status: 'live',
    embeddable: true,
    displayName: channel.slug || parsed.slug,
    title: channel.stream_title || '',
    category: channel.category?.name || '',
    viewerCount: Number(stream.viewer_count || 0),
    startedAt: stream.start_time || null,
    thumbnailUrl: stream.thumbnail || channel.banner_picture || null
  };
}

async function resolveYoutubeChannelId(parsed, apiKey) {
  if (parsed.channelId) return parsed.channelId;
  if (!parsed.handle) return '';

  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'id');
  url.searchParams.set('forHandle', parsed.handle);
  url.searchParams.set('key', apiKey);
  const data = await fetchJson(url);
  return data?.items?.[0]?.id || '';
}

async function youtubeVideoPreview(videoId, apiKey) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,liveStreamingDetails');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey);
  const data = await fetchJson(url);
  const video = data?.items?.[0] || null;
  if (!video) return { platform: 'youtube', status: 'unknown', embeddable: true };

  const live = video.snippet?.liveBroadcastContent === 'live';
  return {
    platform: 'youtube',
    status: live ? 'live' : 'offline',
    embeddable: true,
    liveVideoId: live ? videoId : null,
    displayName: video.snippet?.channelTitle || '',
    title: video.snippet?.title || '',
    category: video.snippet?.channelTitle || '',
    viewerCount: Number(video.liveStreamingDetails?.concurrentViewers || 0),
    startedAt: video.liveStreamingDetails?.actualStartTime || null,
    thumbnailUrl: video.snippet?.thumbnails?.maxres?.url || video.snippet?.thumbnails?.high?.url || null
  };
}

async function youtubePreview(parsed) {
  const apiKey = process.env.YOUTUBE_API_KEY || '';
  if (!apiKey) return { platform: 'youtube', status: 'unknown', embeddable: true, reason: 'not_configured' };

  if (parsed.videoId) return youtubeVideoPreview(parsed.videoId, apiKey);

  const channelId = await resolveYoutubeChannelId(parsed, apiKey);
  if (!channelId) return { platform: 'youtube', status: 'unknown', embeddable: true };

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('eventType', 'live');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key', apiKey);
  const data = await fetchJson(url);
  const item = data?.items?.[0] || null;
  if (!item?.id?.videoId) return { platform: 'youtube', status: 'offline', embeddable: true };

  return {
    platform: 'youtube',
    status: 'live',
    embeddable: true,
    liveVideoId: item.id.videoId,
    displayName: item.snippet?.channelTitle || '',
    title: item.snippet?.title || '',
    category: item.snippet?.channelTitle || '',
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || null,
    startedAt: item.snippet?.publishedAt || null
  };
}

export async function getStreamPreview(channelUrl) {
  const parsed = parseChannelUrl(channelUrl);
  const cacheKey = `${parsed.platform}:${String(channelUrl || '').trim().toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    let preview;
    if (parsed.platform === 'twitch') preview = await twitchPreview(parsed);
    else if (parsed.platform === 'kick') preview = await kickPreview(parsed);
    else if (parsed.platform === 'youtube') preview = await youtubePreview(parsed);
    else preview = { platform: parsed.platform, status: 'unsupported', embeddable: false };

    return cacheSet(cacheKey, preview, parsed.platform === 'youtube' ? YOUTUBE_PREVIEW_TTL_MS : PREVIEW_TTL_MS);
  } catch (error) {
    logger.warn('Streamer preview provider unavailable', { platform: parsed.platform, error: error.message });
    return cacheSet(cacheKey, {
      platform: parsed.platform,
      status: 'unknown',
      embeddable: ['twitch', 'kick', 'youtube'].includes(parsed.platform),
      reason: 'provider_error'
    }, 20_000);
  }
}
