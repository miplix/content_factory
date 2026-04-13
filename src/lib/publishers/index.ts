// ============================================================
// Content Factory — Publisher Router
// Routes content to the correct platform publisher
// ============================================================
import type { ContentItem, AppConfig, PublishResult, Platform } from '../types';
import { publishToTelegram } from './telegram';
import { publishToYouTube } from './youtube';
import { publishToInstagram } from './instagram';
import { publishToTikTok } from './tiktok';
import { publishToVK } from './vk';

export async function publishContent(item: ContentItem, config: AppConfig): Promise<PublishResult> {
  const platformConfig = config.platforms[item.platform];

  if (!platformConfig) {
    return {
      success: false,
      platform: item.platform,
      error: `Platform ${item.platform} not configured`,
      timestamp: new Date().toISOString(),
    };
  }

  switch (item.platform) {
    case 'telegram':
      return publishToTelegram(item, platformConfig as AppConfig['platforms']['telegram'] & object);
    case 'youtube':
      return publishToYouTube(item, platformConfig as AppConfig['platforms']['youtube'] & object);
    case 'instagram':
      return publishToInstagram(item, platformConfig as AppConfig['platforms']['instagram'] & object);
    case 'tiktok':
      return publishToTikTok(item, platformConfig as AppConfig['platforms']['tiktok'] & object);
    case 'vk':
      return publishToVK(item, platformConfig as AppConfig['platforms']['vk'] & object);
    default:
      return {
        success: false,
        platform: item.platform,
        error: `Publisher for ${item.platform} not implemented`,
        timestamp: new Date().toISOString(),
      };
  }
}

// --- Health check all platforms ---
export async function checkAllPlatforms(config: AppConfig): Promise<Record<string, { ok: boolean; details?: string; error?: string }>> {
  const results: Record<string, { ok: boolean; details?: string; error?: string }> = {};

  const checks: Array<{ platform: Platform; check: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>> }> = [];

  if (config.platforms.telegram) {
    const { checkTelegramConnection } = await import('./telegram');
    const tgConfig = config.platforms.telegram;
    checks.push({
      platform: 'telegram',
      check: () => checkTelegramConnection(tgConfig),
    });
  }

  if (config.platforms.youtube) {
    const { checkYouTubeConnection } = await import('./youtube');
    const ytConfig = config.platforms.youtube;
    checks.push({
      platform: 'youtube',
      check: () => checkYouTubeConnection(ytConfig),
    });
  }

  if (config.platforms.instagram) {
    const { checkInstagramConnection } = await import('./instagram');
    const igConfig = config.platforms.instagram;
    checks.push({
      platform: 'instagram',
      check: () => checkInstagramConnection(igConfig),
    });
  }

  if (config.platforms.tiktok) {
    const { checkTikTokConnection } = await import('./tiktok');
    const ttConfig = config.platforms.tiktok;
    checks.push({
      platform: 'tiktok',
      check: () => checkTikTokConnection(ttConfig),
    });
  }

  if (config.platforms.vk) {
    const { checkVKConnection } = await import('./vk');
    const vkConfig = config.platforms.vk;
    checks.push({
      platform: 'vk',
      check: () => checkVKConnection(vkConfig),
    });
  }

  await Promise.all(
    checks.map(async ({ platform, check }) => {
      try {
        const result = await check();
        results[platform] = {
          ok: result.ok,
          details: JSON.stringify(result),
          error: result.error,
        };
      } catch (error) {
        results[platform] = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  return results;
}
