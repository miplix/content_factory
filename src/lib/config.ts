// ============================================================
// Content Factory — Configuration Loader (YupSoul)
// Supports: Gemini (free) > DeepSeek (free) > Ollama (free) > Anthropic > OpenAI
// ============================================================
import type { AppConfig, Platform, LLMProvider } from './types';

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export function loadConfig(): AppConfig {
  return {
    brand: {
      name: env('BRAND_NAME', 'YupSoul'),
      description: env('BRAND_DESCRIPTION', 'Telegram Mini App — персонализированные AI-музыкальные композиции на основе астрологического профиля'),
      targetAudience: env('BRAND_TARGET_AUDIENCE', 'Женщины 18-40, астрология, самопознание, AI'),
      tone: (env('BRAND_TONE', 'mystical') as AppConfig['brand']['tone']),
      topics: env('BRAND_TOPICS', 'звук_знака,совместимость,энергия_дня,астро_факты,мемы_знаков').split(',').map(t => t.trim()).filter(Boolean),
      colors: {
        primary: env('BRAND_COLOR_PRIMARY', '#2D1B69'),
        secondary: env('BRAND_COLOR_SECONDARY', '#1A1A3E'),
        accent: env('BRAND_COLOR_ACCENT', '#D4A574'),
      },
      language: (env('BRAND_LANGUAGE', 'ru') as 'ru' | 'en' | 'both'),
      logoUrl: env('BRAND_LOGO_URL') || undefined,
      siteUrl: env('BRAND_SITE_URL', 'https://www.yupsoul.online/') || undefined,
      botUrl: env('BRAND_BOT_URL', 'https://t.me/Yup_Soul_bot?start=ref_miplix') || undefined,
    },
    generation: {
      // LLM providers (free first)
      geminiApiKey: env('GEMINI_API_KEY') || undefined,
      geminiModel: env('GEMINI_MODEL', 'gemini-2.5-flash-lite') || undefined,
      deepseekApiKey: env('DEEPSEEK_API_KEY') || undefined,
      ollamaBaseUrl: env('OLLAMA_BASE_URL') || undefined,
      ollamaModel: env('OLLAMA_MODEL', 'qwen3:7b') || undefined,
      anthropicApiKey: env('ANTHROPIC_API_KEY') || undefined,
      openaiApiKey: env('OPENAI_API_KEY') || undefined,

      // Image
      stabilityApiKey: env('STABILITY_API_KEY') || undefined,
      replicateApiKey: env('REPLICATE_API_KEY') || undefined,

      // TTS
      fishAudioApiKey: env('FISH_AUDIO_API_KEY') || undefined,
      elevenLabsApiKey: env('ELEVENLABS_API_KEY') || undefined,
    },
    platforms: {
      telegram: env('TELEGRAM_BOT_TOKEN') ? {
        botToken: env('TELEGRAM_BOT_TOKEN'),
        channelId: env('TELEGRAM_CHANNEL_ID'),
        reportChatId: env('TELEGRAM_REPORT_CHAT_ID'),
      } : undefined,
      youtube: env('YOUTUBE_CLIENT_ID') ? {
        clientId: env('YOUTUBE_CLIENT_ID'),
        clientSecret: env('YOUTUBE_CLIENT_SECRET'),
        refreshToken: env('YOUTUBE_REFRESH_TOKEN'),
        channelId: env('YOUTUBE_CHANNEL_ID'),
      } : undefined,
      instagram: env('INSTAGRAM_ACCESS_TOKEN') ? {
        accessToken: env('INSTAGRAM_ACCESS_TOKEN'),
        businessAccountId: env('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
      } : undefined,
      tiktok: env('TIKTOK_ACCESS_TOKEN') ? {
        accessToken: env('TIKTOK_ACCESS_TOKEN'),
        openId: env('TIKTOK_OPEN_ID'),
      } : undefined,
      vk: env('VK_ACCESS_TOKEN') ? {
        accessToken: env('VK_ACCESS_TOKEN'),
        groupId: env('VK_GROUP_ID'),
      } : undefined,
      twitter: env('TWITTER_API_KEY') ? {
        apiKey: env('TWITTER_API_KEY'),
        apiSecret: env('TWITTER_API_SECRET'),
        accessToken: env('TWITTER_ACCESS_TOKEN'),
        accessTokenSecret: env('TWITTER_ACCESS_TOKEN_SECRET'),
      } : undefined,
    },
    schedule: {
      timezone: env('SCHEDULE_TIMEZONE', 'Europe/Moscow'),
      postsPerDay: parsePostsPerDay(env('SCHEDULE_POSTS_PER_DAY', 'telegram:3,instagram:1,tiktok:2,youtube:1,vk:1')),
      publishTimes: parsePublishTimes(env('SCHEDULE_PUBLISH_TIMES', 'telegram:09:00,15:00,20:00;instagram:11:00;tiktok:12:00,22:00;youtube:14:00;vk:13:00')),
    },
  };
}

function parsePostsPerDay(str: string): Partial<Record<Platform, number>> {
  const result: Partial<Record<Platform, number>> = {};
  for (const part of str.split(',')) {
    const [platform, count] = part.split(':');
    if (platform && count) {
      result[platform.trim() as Platform] = parseInt(count.trim(), 10);
    }
  }
  return result;
}

function parsePublishTimes(str: string): Partial<Record<Platform, string[]>> {
  const result: Partial<Record<Platform, string[]>> = {};
  for (const platformBlock of str.split(';')) {
    const [platform, ...times] = platformBlock.split(':');
    if (platform) {
      result[platform.trim() as Platform] = times.join(':').split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  return result;
}

export function getEnabledPlatforms(config: AppConfig): Platform[] {
  return Object.entries(config.platforms)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k as Platform);
}

// --- Determine active LLM provider ---
export function getActiveLLMProvider(config: AppConfig): LLMProvider | null {
  if (config.generation.geminiApiKey) return 'gemini';
  if (config.generation.deepseekApiKey) return 'deepseek';
  if (config.generation.ollamaBaseUrl) return 'ollama';
  if (config.generation.anthropicApiKey) return 'anthropic';
  if (config.generation.openaiApiKey) return 'openai';
  return null;
}

// --- Determine active image provider ---
export function getActiveImageProvider(config: AppConfig): string | null {
  if (config.generation.stabilityApiKey) return 'stability';
  if (config.generation.openaiApiKey) return 'openai';
  if (config.generation.replicateApiKey) return 'replicate';
  return null;
}
