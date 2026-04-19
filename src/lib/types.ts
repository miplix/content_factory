// ============================================================
// Content Factory — Core Types (YupSoul)
// ============================================================

// --- Platform Types ---
export type Platform = 'telegram' | 'youtube' | 'instagram' | 'tiktok' | 'vk' | 'twitter';

export type ContentFormat = 'text' | 'image' | 'video' | 'carousel' | 'reels' | 'shorts' | 'story';

export type ContentStatus =
  | 'planned'
  | 'generating'
  | 'generated'
  | 'validating'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'failed';

// --- Zodiac ---
export type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export const ZODIAC_SIGNS: ZodiacSign[] = [
  'aries', 'taurus', 'gemini', 'cancer',
  'leo', 'virgo', 'libra', 'scorpio',
  'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

export const ZODIAC_RU: Record<ZodiacSign, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак',
  leo: 'Лев', virgo: 'Дева', libra: 'Весы', scorpio: 'Скорпион',
  sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};

export const ZODIAC_EMOJI: Record<ZodiacSign, string> = {
  aries: '\u2648\uFE0F', taurus: '\u2649\uFE0F', gemini: '\u264A\uFE0F', cancer: '\u264B\uFE0F',
  leo: '\u264C\uFE0F', virgo: '\u264D\uFE0F', libra: '\u264E\uFE0F', scorpio: '\u264F\uFE0F',
  sagittarius: '\u2650\uFE0F', capricorn: '\u2651\uFE0F', aquarius: '\u2652\uFE0F', pisces: '\u2653\uFE0F',
};

// --- Content Rubrics (20 rubrics from strategy) ---
export type ContentRubric =
  | 'zodiac_sound'           // Звук твоего знака
  | 'track_reactions'        // Реакции на свой трек
  | 'compatibility'          // Совместимость в музыке
  | 'daily_energy'           // Энергия дня
  | 'astro_facts'            // Астро-факты + музыка
  | 'signs_as_genres'        // Знаки как жанры музыки
  | 'gift'                   // Подарок, который невозможно забыть
  | 'backstage_ai'           // Backstage: как AI создаёт музыку
  | 'retrograde'             // Ретроград выживание
  | 'zodiac_memes'           // Знаки зодиака в ситуациях
  | 'meditation'             // Медитация дня
  | 'compare_tracks'         // Сравни свой трек
  | 'celebrities'            // Знаменитости и их звук
  | 'moon_phases'            // Полнолуние / Новолуние
  | 'astro_music_history'    // История астрологии + музыки
  | 'zodiac_battle'          // Батл знаков
  | 'morning_ritual'         // Утренний ритуал
  | 'tutorial'               // Как это работает
  | 'reviews'                // Отзывы и истории
  | 'cosmic_news';           // Cosmic news

export const RUBRIC_RU: Record<ContentRubric, string> = {
  zodiac_sound: 'Звук твоего знака',
  track_reactions: 'Реакции на свой трек',
  compatibility: 'Совместимость в музыке',
  daily_energy: 'Энергия дня',
  astro_facts: 'Астро-факты + музыка',
  signs_as_genres: 'Знаки как жанры музыки',
  gift: 'Подарок, который невозможно забыть',
  backstage_ai: 'Backstage: как AI создаёт музыку',
  retrograde: 'Ретроград выживание',
  zodiac_memes: 'Знаки зодиака в ситуациях',
  meditation: 'Медитация дня',
  compare_tracks: 'Сравни свой трек',
  celebrities: 'Знаменитости и их звук',
  moon_phases: 'Полнолуние / Новолуние',
  astro_music_history: 'История астрологии + музыки',
  zodiac_battle: 'Батл знаков',
  morning_ritual: 'Утренний ритуал',
  tutorial: 'Как это работает',
  reviews: 'Отзывы и истории',
  cosmic_news: 'Cosmic news',
};

// --- Content Item ---
export interface ContentItem {
  id: string;
  title: string;
  topic: string;
  platform: Platform;
  format: ContentFormat;
  status: ContentStatus;
  rubric?: ContentRubric;
  zodiacSign?: ZodiacSign;

  // Generated content
  text?: string;
  caption?: string;
  hashtags?: string[];
  imageUrl?: string;
  videoUrl?: string;
  mediaUrls?: string[];

  // Scheduling
  scheduledAt: string; // ISO date
  publishedAt?: string;
  publishedUrl?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  error?: string;

  // Analytics (post-publish)
  analytics?: ContentAnalytics;
}

export interface ContentAnalytics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  subscribers?: number;
  clicks?: number;
  fetchedAt: string;
}

// --- Content Plan ---
export interface ContentPlan {
  id: string;
  weekStart: string; // ISO date, Monday
  items: ContentItem[];
  createdAt: string;
}

// --- LLM Provider ---
export type LLMProvider = 'gemini' | 'deepseek' | 'ollama' | 'anthropic' | 'openai';

// --- Platform Config ---
export interface TelegramConfig {
  botToken: string;
  channelId: string;
  reportChatId: string;
}

export interface YouTubeConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  channelId: string;
}

export interface InstagramConfig {
  accessToken: string;
  businessAccountId: string;
}

export interface TikTokConfig {
  accessToken: string;
  openId: string;
}

export interface VKConfig {
  accessToken: string;
  groupId: string;
}

export interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

// --- Generation Config ---
export interface GenerationConfig {
  // LLM (priority: first available wins)
  geminiApiKey?: string;
  geminiModel?: string;
  deepseekApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;

  // Image
  stabilityApiKey?: string;
  replicateApiKey?: string;

  // TTS
  fishAudioApiKey?: string;
  elevenLabsApiKey?: string;
}

// --- Brand Config ---
export interface BrandConfig {
  name: string;
  description: string;
  targetAudience: string;
  tone: 'expert' | 'friendly' | 'provocative' | 'informative' | 'humorous' | 'mystical';
  topics: string[];
  colors: { primary: string; secondary: string; accent: string };
  language: 'ru' | 'en' | 'both';
  logoUrl?: string;
  siteUrl?: string;
  botUrl?: string;
}

// --- Main Config ---
export interface AppConfig {
  brand: BrandConfig;
  generation: GenerationConfig;
  platforms: {
    telegram?: TelegramConfig;
    youtube?: YouTubeConfig;
    instagram?: InstagramConfig;
    tiktok?: TikTokConfig;
    vk?: VKConfig;
    twitter?: TwitterConfig;
  };
  schedule: ScheduleConfig;
}

export interface ScheduleConfig {
  timezone: string;
  postsPerDay: Partial<Record<Platform, number>>;
  publishTimes: Partial<Record<Platform, string[]>>;
}

// --- Report Types ---
export interface DailyReport {
  date: string;
  published: number;
  failed: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  byPlatform: Partial<Record<Platform, {
    published: number;
    views: number;
    likes: number;
    subscribers: number;
  }>>;
  topContent?: ContentItem;
}

export interface WeeklyReport extends DailyReport {
  weekStart: string;
  weekEnd: string;
  subscriberGrowth: Partial<Record<Platform, number>>;
}

// --- Validator Types ---
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// --- Publisher Result ---
export interface PublishResult {
  success: boolean;
  platform: Platform;
  url?: string;
  error?: string;
  timestamp: string;
}
