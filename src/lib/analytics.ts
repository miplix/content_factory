// ============================================================
// Content Factory — Analytics & Statistics Collector
// Gathers stats from all connected platforms
// ============================================================
import type { AppConfig, Platform, ContentAnalytics, DailyReport, WeeklyReport } from './types';
import { loadConfig, getEnabledPlatforms } from './config';
import { getContentItems, getReports } from './db';

// --- Platform Stats Fetchers ---
interface PlatformStats {
  subscribers: number;
  totalViews: number;
  platform: Platform;
  fetchedAt: string;
}

async function fetchTelegramStats(config: AppConfig): Promise<PlatformStats | null> {
  if (!config.platforms.telegram) return null;
  try {
    const { getTelegramChannelInfo } = await import('./publishers/telegram');
    const info = await getTelegramChannelInfo(config.platforms.telegram);
    if (!info) return null;
    return {
      platform: 'telegram',
      subscribers: info.memberCount,
      totalViews: 0, // Telegram doesn't expose total views via bot API
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchYouTubeStats(config: AppConfig): Promise<PlatformStats | null> {
  if (!config.platforms.youtube) return null;
  try {
    const { getYouTubeChannelStats } = await import('./publishers/youtube');
    const stats = await getYouTubeChannelStats(config.platforms.youtube);
    if (!stats) return null;
    return {
      platform: 'youtube',
      subscribers: stats.subscriberCount,
      totalViews: stats.viewCount,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchInstagramStats(config: AppConfig): Promise<PlatformStats | null> {
  if (!config.platforms.instagram) return null;
  try {
    const { getInstagramStats } = await import('./publishers/instagram');
    const stats = await getInstagramStats(config.platforms.instagram);
    if (!stats) return null;
    return {
      platform: 'instagram',
      subscribers: stats.followers,
      totalViews: 0,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchVKStats(config: AppConfig): Promise<PlatformStats | null> {
  if (!config.platforms.vk) return null;
  try {
    const { getVKGroupStats } = await import('./publishers/vk');
    const stats = await getVKGroupStats(config.platforms.vk);
    if (!stats) return null;
    return {
      platform: 'vk',
      subscribers: stats.members,
      totalViews: 0,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// --- Aggregate Stats ---
export async function fetchAllPlatformStats(config?: AppConfig): Promise<PlatformStats[]> {
  const cfg = config || loadConfig();
  const results = await Promise.all([
    fetchTelegramStats(cfg),
    fetchYouTubeStats(cfg),
    fetchInstagramStats(cfg),
    fetchVKStats(cfg),
  ]);
  return results.filter((r): r is PlatformStats => r !== null);
}

// --- Report Generators ---
export async function buildDailyReport(date?: string, config?: AppConfig): Promise<DailyReport> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const items = await getContentItems();
  const dayItems = items.filter(i =>
    (i.publishedAt?.startsWith(targetDate)) || (i.scheduledAt === targetDate)
  );

  const byPlatform: DailyReport['byPlatform'] = {};
  for (const item of dayItems) {
    if (!byPlatform[item.platform]) {
      byPlatform[item.platform] = { published: 0, views: 0, likes: 0, subscribers: 0 };
    }
    if (item.status === 'published') {
      byPlatform[item.platform]!.published++;
    }
    byPlatform[item.platform]!.views += item.analytics?.views || 0;
    byPlatform[item.platform]!.likes += item.analytics?.likes || 0;
  }

  // Get subscriber counts
  const cfg = config || loadConfig();
  const platformStats = await fetchAllPlatformStats(cfg);
  for (const stat of platformStats) {
    if (byPlatform[stat.platform]) {
      byPlatform[stat.platform]!.subscribers = stat.subscribers;
    }
  }

  return {
    date: targetDate,
    published: dayItems.filter(i => i.status === 'published').length,
    failed: dayItems.filter(i => i.status === 'failed').length,
    totalViews: dayItems.reduce((s, i) => s + (i.analytics?.views || 0), 0),
    totalLikes: dayItems.reduce((s, i) => s + (i.analytics?.likes || 0), 0),
    totalComments: dayItems.reduce((s, i) => s + (i.analytics?.comments || 0), 0),
    byPlatform,
    topContent: dayItems
      .filter(i => i.status === 'published')
      .sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0))[0],
  };
}

export async function buildWeeklyReport(config?: AppConfig): Promise<WeeklyReport> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const items = await getContentItems();
  const weekItems = items.filter(i => {
    const d = new Date(i.scheduledAt);
    return d >= weekStart && d <= weekEnd;
  });

  const byPlatform: DailyReport['byPlatform'] = {};
  for (const item of weekItems) {
    if (!byPlatform[item.platform]) {
      byPlatform[item.platform] = { published: 0, views: 0, likes: 0, subscribers: 0 };
    }
    if (item.status === 'published') {
      byPlatform[item.platform]!.published++;
    }
    byPlatform[item.platform]!.views += item.analytics?.views || 0;
    byPlatform[item.platform]!.likes += item.analytics?.likes || 0;
  }

  return {
    date: weekStart.toISOString().split('T')[0],
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    published: weekItems.filter(i => i.status === 'published').length,
    failed: weekItems.filter(i => i.status === 'failed').length,
    totalViews: weekItems.reduce((s, i) => s + (i.analytics?.views || 0), 0),
    totalLikes: weekItems.reduce((s, i) => s + (i.analytics?.likes || 0), 0),
    totalComments: weekItems.reduce((s, i) => s + (i.analytics?.comments || 0), 0),
    byPlatform,
    subscriberGrowth: {}, // Would need historical data to calculate
    topContent: weekItems
      .filter(i => i.status === 'published')
      .sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0))[0],
  };
}

// --- Format Report for Telegram ---
export function formatReportForTelegram(report: DailyReport, type: 'daily' | 'weekly' | 'monthly' = 'daily'): string {
  const emoji = type === 'daily' ? '📊' : type === 'weekly' ? '📈' : '📅';
  const title = type === 'daily' ? 'Ежедневный отчёт' : type === 'weekly' ? 'Недельный отчёт' : 'Месячный отчёт';

  const platformLines = Object.entries(report.byPlatform || {})
    .map(([platform, stats]) => {
      if (!stats) return '';
      return `  📱 <b>${platform}</b>: ${stats.published} постов | 👁 ${stats.views} | ❤️ ${stats.likes} | 👥 ${stats.subscribers}`;
    })
    .filter(Boolean)
    .join('\n');

  return `${emoji} <b>${title} — ${report.date}</b>

✅ Опубликовано: <b>${report.published}</b>
❌ С ошибками: <b>${report.failed}</b>

👁 Просмотров: <b>${report.totalViews}</b>
❤️ Лайков: <b>${report.totalLikes}</b>
💬 Комментариев: <b>${report.totalComments}</b>

${platformLines || '  Нет данных'}

${report.topContent ? `🏆 Лучший пост: <a href="${report.topContent.publishedUrl || '#'}">${report.topContent.title}</a>` : ''}`;
}
