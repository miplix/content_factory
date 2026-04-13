// ============================================================
// Content Factory — YouTube Publisher
// Uses YouTube Data API v3 (free quota: 10,000 units/day)
// ============================================================
import type { ContentItem, YouTubeConfig, PublishResult } from '../types';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_API = 'https://www.googleapis.com/upload/youtube/v3/videos';

// --- OAuth Token Refresh ---
async function refreshAccessToken(config: YouTubeConfig): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) throw new Error(`YouTube token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// --- Upload Video ---
export async function publishToYouTube(item: ContentItem, config: YouTubeConfig): Promise<PublishResult> {
  try {
    const accessToken = await refreshAccessToken(config);

    if (!item.videoUrl) {
      return {
        success: false,
        platform: 'youtube',
        error: 'No video URL provided',
        timestamp: new Date().toISOString(),
      };
    }

    // Download video first (Vercel limitation: need to stream it)
    const videoRes = await fetch(item.videoUrl);
    if (!videoRes.ok) throw new Error('Failed to download video for upload');
    const videoBlob = await videoRes.blob();

    // Step 1: Initialize resumable upload
    const metadata = {
      snippet: {
        title: item.title || item.topic,
        description: item.text || item.caption || '',
        tags: item.hashtags || [],
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    const initRes = await fetch(
      `${YOUTUBE_UPLOAD_API}?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(videoBlob.size),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`YouTube upload init failed: ${err}`);
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) throw new Error('No upload URL returned');

    // Step 2: Upload video data
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoBlob.size),
      },
      body: videoBlob,
    });

    if (!uploadRes.ok) throw new Error(`YouTube upload failed: ${uploadRes.status}`);

    const videoData = await uploadRes.json();

    return {
      success: true,
      platform: 'youtube',
      url: `https://youtube.com/watch?v=${videoData.id}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      platform: 'youtube',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

// --- Channel Stats ---
export async function getYouTubeChannelStats(config: YouTubeConfig): Promise<{
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
} | null> {
  try {
    const accessToken = await refreshAccessToken(config);
    const res = await fetch(
      `${YOUTUBE_API}/channels?part=statistics&id=${config.channelId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const stats = data.items?.[0]?.statistics;
    if (!stats) return null;

    return {
      subscriberCount: parseInt(stats.subscriberCount || '0', 10),
      viewCount: parseInt(stats.viewCount || '0', 10),
      videoCount: parseInt(stats.videoCount || '0', 10),
    };
  } catch {
    return null;
  }
}

// --- Health Check ---
export async function checkYouTubeConnection(config: YouTubeConfig): Promise<{ ok: boolean; channelTitle?: string; error?: string }> {
  try {
    const accessToken = await refreshAccessToken(config);
    const res = await fetch(
      `${YOUTUBE_API}/channels?part=snippet&mine=true`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!res.ok) throw new Error(`YouTube API: ${res.status}`);
    const data = await res.json();
    return { ok: true, channelTitle: data.items?.[0]?.snippet?.title };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
