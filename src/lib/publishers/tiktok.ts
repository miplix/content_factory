// ============================================================
// Content Factory — TikTok Publisher (YupSoul)
// Supports: Photo carousel (primary) + Video upload
// API: TikTok Content Posting API v2
// ============================================================
import type { ContentItem, TikTokConfig, PublishResult } from '../types';

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

// --- Publish Photo Carousel (основной формат) ---
export async function publishTikTokCarousel(
  item: ContentItem,
  config: TikTokConfig
): Promise<PublishResult> {
  try {
    const imageUrls = item.mediaUrls || (item.imageUrl ? [item.imageUrl] : []);

    if (imageUrls.length === 0) {
      return {
        success: false,
        platform: 'tiktok',
        error: 'TikTok carousel requires at least 1 image',
        timestamp: new Date().toISOString(),
      };
    }

    // TikTok Photo Post API
    // https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
    const caption = buildCaption(item);

    const initRes = await fetch(`${TIKTOK_API}/post/publish/content/init/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: caption,
          description: caption,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
          auto_add_music: true, // TikTok добавит трендовый звук
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 0,
          photo_images: imageUrls,
        },
        post_mode: 'DIRECT_POST',
        media_type: 'PHOTO',
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`TikTok carousel init error ${initRes.status}: ${err}`);
    }

    const initData = await initRes.json();
    const publishId = initData.data?.publish_id;

    if (!publishId) {
      throw new Error(`TikTok: no publish_id returned. Response: ${JSON.stringify(initData)}`);
    }

    // Проверяем статус публикации
    const result = await pollPublishStatus(publishId, config);
    return result;
  } catch (error) {
    return {
      success: false,
      platform: 'tiktok',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

// --- Publish Video (fallback) ---
export async function publishToTikTok(item: ContentItem, config: TikTokConfig): Promise<PublishResult> {
  // Если есть несколько картинок — публикуем как карусель
  if (item.mediaUrls && item.mediaUrls.length > 0 && !item.videoUrl) {
    return publishTikTokCarousel(item, config);
  }

  // Если только одна картинка и нет видео — тоже карусель
  if (item.imageUrl && !item.videoUrl) {
    return publishTikTokCarousel(
      { ...item, mediaUrls: [item.imageUrl] },
      config
    );
  }

  // Видео
  try {
    if (!item.videoUrl) {
      return {
        success: false,
        platform: 'tiktok',
        error: 'TikTok requires video or images',
        timestamp: new Date().toISOString(),
      };
    }

    const caption = buildCaption(item);

    const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: caption,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: item.videoUrl,
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`TikTok video init error ${initRes.status}: ${err}`);
    }

    const initData = await initRes.json();
    const publishId = initData.data?.publish_id;

    if (!publishId) {
      throw new Error('TikTok: No publish_id returned');
    }

    return await pollPublishStatus(publishId, config);
  } catch (error) {
    return {
      success: false,
      platform: 'tiktok',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

// --- Poll publish status ---
async function pollPublishStatus(publishId: string, config: TikTokConfig): Promise<PublishResult> {
  for (let i = 0; i < 30; i++) {
    const statusRes = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === 'PUBLISH_COMPLETE') {
      return {
        success: true,
        platform: 'tiktok',
        url: `https://www.tiktok.com/@${config.openId}`,
        timestamp: new Date().toISOString(),
      };
    }

    if (status === 'FAILED') {
      return {
        success: false,
        platform: 'tiktok',
        error: `TikTok publish failed: ${statusData.data?.fail_reason || 'unknown'}`,
        timestamp: new Date().toISOString(),
      };
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  return {
    success: false,
    platform: 'tiktok',
    error: 'TikTok publish timeout — still processing',
    timestamp: new Date().toISOString(),
  };
}

// --- Build caption with hashtags ---
function buildCaption(item: ContentItem): string {
  const text = (item.caption || item.text || '').slice(0, 200);
  const hashtags = (item.hashtags || []).slice(0, 5).join(' ');
  const caption = `${text}\n\n${hashtags}`.trim();
  return caption.slice(0, 300); // TikTok limit
}

// --- Health Check ---
export async function checkTikTokConnection(config: TikTokConfig): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(`${TIKTOK_API}/user/info/?fields=display_name,avatar_url`, {
      headers: { 'Authorization': `Bearer ${config.accessToken}` },
    });

    if (!res.ok) throw new Error(`TikTok API: ${res.status}`);
    const data = await res.json();
    return { ok: true, username: data.data?.user?.display_name };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
