// ============================================================
// Content Factory — Instagram Publisher
// Uses Instagram Graph API (requires Meta Business account)
// ============================================================
import type { ContentItem, InstagramConfig, PublishResult } from '../types';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// --- Publish Photo ---
async function publishPhoto(imageUrl: string, caption: string, config: InstagramConfig): Promise<string> {
  // Step 1: Create media container
  const createRes = await fetch(
    `${GRAPH_API}/${config.businessAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: config.accessToken,
      }),
    }
  );

  if (!createRes.ok) throw new Error(`IG create container: ${createRes.status}`);
  const { id: containerId } = await createRes.json();

  // Step 2: Publish container
  const publishRes = await fetch(
    `${GRAPH_API}/${config.businessAccountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: config.accessToken,
      }),
    }
  );

  if (!publishRes.ok) throw new Error(`IG publish: ${publishRes.status}`);
  const { id: mediaId } = await publishRes.json();
  return mediaId;
}

// --- Publish Carousel ---
async function publishCarousel(imageUrls: string[], caption: string, config: InstagramConfig): Promise<string> {
  // Create individual containers
  const containerIds = await Promise.all(
    imageUrls.map(async (url) => {
      const res = await fetch(
        `${GRAPH_API}/${config.businessAccountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: config.accessToken,
          }),
        }
      );
      const data = await res.json();
      return data.id;
    })
  );

  // Create carousel container
  const carouselRes = await fetch(
    `${GRAPH_API}/${config.businessAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: containerIds,
        caption,
        access_token: config.accessToken,
      }),
    }
  );

  const { id: carouselId } = await carouselRes.json();

  // Publish
  const publishRes = await fetch(
    `${GRAPH_API}/${config.businessAccountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselId,
        access_token: config.accessToken,
      }),
    }
  );

  const { id: mediaId } = await publishRes.json();
  return mediaId;
}

// --- Publish Reels ---
async function publishReels(videoUrl: string, caption: string, config: InstagramConfig): Promise<string> {
  const createRes = await fetch(
    `${GRAPH_API}/${config.businessAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: config.accessToken,
      }),
    }
  );

  const { id: containerId } = await createRes.json();

  // Wait for processing (Instagram needs time)
  await waitForMediaReady(containerId, config);

  const publishRes = await fetch(
    `${GRAPH_API}/${config.businessAccountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: config.accessToken,
      }),
    }
  );

  const { id: mediaId } = await publishRes.json();
  return mediaId;
}

async function waitForMediaReady(containerId: string, config: InstagramConfig, maxWait = 60): Promise<void> {
  for (let i = 0; i < maxWait; i++) {
    const res = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code&access_token=${config.accessToken}`
    );
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Instagram media processing failed');
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Instagram media processing timeout');
}

// --- Main Publisher ---
export async function publishToInstagram(item: ContentItem, config: InstagramConfig): Promise<PublishResult> {
  try {
    const caption = buildCaption(item);
    let mediaId: string;

    if (item.format === 'carousel' && item.mediaUrls && item.mediaUrls.length > 1) {
      mediaId = await publishCarousel(item.mediaUrls, caption, config);
    } else if (item.format === 'reels' && item.videoUrl) {
      mediaId = await publishReels(item.videoUrl, caption, config);
    } else if (item.imageUrl) {
      mediaId = await publishPhoto(item.imageUrl, caption, config);
    } else {
      return {
        success: false,
        platform: 'instagram',
        error: 'Instagram requires image or video content',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      platform: 'instagram',
      url: `https://www.instagram.com/p/${mediaId}`, // Approximate
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      platform: 'instagram',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

function buildCaption(item: ContentItem): string {
  const text = item.caption || item.text || '';
  const hashtags = item.hashtags?.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') || '';
  const combined = `${text}\n\n${hashtags}`;
  return combined.slice(0, 2200);
}

// --- Health Check ---
export async function checkInstagramConnection(config: InstagramConfig): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(
      `${GRAPH_API}/${config.businessAccountId}?fields=username&access_token=${config.accessToken}`
    );
    if (!res.ok) throw new Error(`Instagram API: ${res.status}`);
    const data = await res.json();
    return { ok: true, username: data.username };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// --- Account Stats ---
export async function getInstagramStats(config: InstagramConfig): Promise<{
  followers: number;
  mediaCount: number;
} | null> {
  try {
    const res = await fetch(
      `${GRAPH_API}/${config.businessAccountId}?fields=followers_count,media_count&access_token=${config.accessToken}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      followers: data.followers_count || 0,
      mediaCount: data.media_count || 0,
    };
  } catch {
    return null;
  }
}
