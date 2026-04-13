// ============================================================
// Content Factory — VK Publisher
// Uses VK API (free, generous limits)
// ============================================================
import type { ContentItem, VKConfig, PublishResult } from '../types';

const VK_API = 'https://api.vk.com/method';
const VK_API_VERSION = '5.199';

async function vkApi(method: string, params: Record<string, string>, token: string): Promise<unknown> {
  const searchParams = new URLSearchParams({
    ...params,
    access_token: token,
    v: VK_API_VERSION,
  });

  const res = await fetch(`${VK_API}/${method}?${searchParams}`);
  const data = await res.json();

  if (data.error) {
    throw new Error(`VK API error: ${data.error.error_msg}`);
  }

  return data.response;
}

// --- Upload Photo to VK ---
async function uploadPhoto(imageUrl: string, config: VKConfig): Promise<string> {
  // Step 1: Get upload URL
  const uploadServer = await vkApi('photos.getWallUploadServer', {
    group_id: config.groupId,
  }, config.accessToken) as { upload_url: string };

  // Step 2: Download image
  const imageRes = await fetch(imageUrl);
  const imageBlob = await imageRes.blob();

  // Step 3: Upload to VK server
  const formData = new FormData();
  formData.append('photo', imageBlob, 'photo.jpg');

  const uploadRes = await fetch(uploadServer.upload_url, {
    method: 'POST',
    body: formData,
  });
  const uploadData = await uploadRes.json();

  // Step 4: Save photo
  const saved = await vkApi('photos.saveWallPhoto', {
    group_id: config.groupId,
    photo: uploadData.photo,
    server: String(uploadData.server),
    hash: uploadData.hash,
  }, config.accessToken) as Array<{ owner_id: number; id: number }>;

  return `photo${saved[0].owner_id}_${saved[0].id}`;
}

// --- Publish Post ---
export async function publishToVK(item: ContentItem, config: VKConfig): Promise<PublishResult> {
  try {
    const params: Record<string, string> = {
      owner_id: `-${config.groupId}`,
      from_group: '1',
      message: item.text || item.caption || '',
    };

    // Attach photo if available
    if (item.imageUrl && item.format !== 'text') {
      try {
        const attachment = await uploadPhoto(item.imageUrl, config);
        params.attachments = attachment;
      } catch (e) {
        console.error('VK photo upload failed:', e);
      }
    }

    const result = await vkApi('wall.post', params, config.accessToken) as { post_id: number };

    return {
      success: true,
      platform: 'vk',
      url: `https://vk.com/wall-${config.groupId}_${result.post_id}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      platform: 'vk',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

// --- Health Check ---
export async function checkVKConnection(config: VKConfig): Promise<{ ok: boolean; groupName?: string; error?: string }> {
  try {
    const result = await vkApi('groups.getById', {
      group_id: config.groupId,
    }, config.accessToken) as { groups: Array<{ name: string }> };

    return { ok: true, groupName: result.groups?.[0]?.name };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// --- Group Stats ---
export async function getVKGroupStats(config: VKConfig): Promise<{
  members: number;
} | null> {
  try {
    const result = await vkApi('groups.getById', {
      group_id: config.groupId,
      fields: 'members_count',
    }, config.accessToken) as { groups: Array<{ members_count: number }> };

    return { members: result.groups?.[0]?.members_count || 0 };
  } catch {
    return null;
  }
}
