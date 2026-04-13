// ============================================================
// Content Factory — Orchestrator (YupSoul)
// Main pipeline: Plan -> Generate -> Validate -> Publish -> Report
// ============================================================
import type { AppConfig, ContentItem, ContentFormat, ContentRubric, ZodiacSign, Platform, DailyReport } from './types';
import { loadConfig, getEnabledPlatforms } from './config';
import { generateText, generateContentPlan } from './generators/text';
import { generateImage } from './generators/image';
import { publishContent } from './publishers';
import { getContentItems, upsertContentItem, generateId } from './db';

// --- Step 1: Generate Content Plan ---
export async function runPlanGeneration(config?: AppConfig): Promise<ContentItem[]> {
  const cfg = config || loadConfig();
  const platforms = getEnabledPlatforms(cfg);

  if (platforms.length === 0) {
    throw new Error('No platforms configured');
  }

  const planItems = await generateContentPlan({
    brand: cfg.brand,
    platforms,
    postsPerDay: cfg.schedule.postsPerDay,
    daysAhead: 7,
    config: cfg,
  });

  const contentItems: ContentItem[] = planItems.map(item => ({
    id: generateId(),
    title: item.topic,
    topic: item.topic,
    platform: item.platform,
    format: item.format as ContentFormat,
    status: 'planned',
    scheduledAt: item.scheduledDate,
    rubric: item.rubric as ContentRubric | undefined,
    zodiacSign: item.zodiacSign as ZodiacSign | undefined,
    hashtags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  // Save all planned items
  for (const item of contentItems) {
    await upsertContentItem(item);
  }

  return contentItems;
}

// --- Step 2: Generate Content for an Item ---
export async function runContentGeneration(itemId: string, config?: AppConfig): Promise<ContentItem> {
  const cfg = config || loadConfig();
  const items = await getContentItems();
  const item = items.find(i => i.id === itemId);
  if (!item) throw new Error(`Item ${itemId} not found`);

  // Update status
  item.status = 'generating';
  await upsertContentItem(item);

  try {
    // Generate text
    const textResult = await generateText({
      topic: item.topic,
      platform: item.platform,
      format: item.format,
      brand: cfg.brand,
      rubric: item.rubric,
      zodiacSign: item.zodiacSign,
      config: cfg,
    });

    item.text = textResult.text;
    item.caption = textResult.caption;
    item.hashtags = textResult.hashtags;

    // Generate image (if format needs it)
    if (['image', 'carousel', 'story'].includes(item.format)) {
      const imageResult = await generateImage({
        topic: item.topic,
        platform: item.platform,
        brand: cfg.brand,
        zodiacSign: item.zodiacSign,
        rubric: item.rubric,
        config: cfg,
      });
      item.imageUrl = imageResult.imageUrl;
    }

    item.status = 'generated';
    await upsertContentItem(item);
    return item;
  } catch (error) {
    item.status = 'failed';
    item.error = error instanceof Error ? error.message : String(error);
    await upsertContentItem(item);
    throw error;
  }
}

// --- Step 3: Publish Content ---
export async function runPublish(itemId: string, config?: AppConfig): Promise<ContentItem> {
  const cfg = config || loadConfig();
  const items = await getContentItems();
  const item = items.find(i => i.id === itemId);
  if (!item) throw new Error(`Item ${itemId} not found`);

  if (!['generated', 'ready'].includes(item.status)) {
    throw new Error(`Item ${itemId} is not ready for publishing (status: ${item.status})`);
  }

  item.status = 'publishing';
  await upsertContentItem(item);

  const result = await publishContent(item, cfg);

  if (result.success) {
    item.status = 'published';
    item.publishedAt = result.timestamp;
    item.publishedUrl = result.url;
  } else {
    item.status = 'failed';
    item.error = result.error;
  }

  await upsertContentItem(item);
  return item;
}

// --- Full Pipeline: Generate + Publish due items ---
export async function runDailyPipeline(config?: AppConfig): Promise<{
  generated: number;
  published: number;
  failed: number;
  errors: string[];
}> {
  const cfg = config || loadConfig();
  const today = new Date().toISOString().split('T')[0];
  const results = { generated: 0, published: 0, failed: 0, errors: [] as string[] };

  // Get items scheduled for today that are still planned
  const allItems = await getContentItems();
  const dueItems = allItems.filter(
    i => i.scheduledAt === today && i.status === 'planned'
  );

  // If no items planned, generate some
  if (dueItems.length === 0) {
    try {
      const newItems = await runPlanGeneration(cfg);
      const todayItems = newItems.filter(i => i.scheduledAt === today);
      dueItems.push(...todayItems);
    } catch (e) {
      results.errors.push(`Plan generation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Generate and publish each item
  for (const item of dueItems) {
    try {
      await runContentGeneration(item.id, cfg);
      results.generated++;
    } catch (e) {
      results.failed++;
      results.errors.push(`Gen failed [${item.platform}/${item.topic}]: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    try {
      await runPublish(item.id, cfg);
      results.published++;
    } catch (e) {
      results.failed++;
      results.errors.push(`Pub failed [${item.platform}/${item.topic}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return results;
}

// --- Generate Daily Report ---
export async function generateDailyReport(config?: AppConfig): Promise<DailyReport> {
  const today = new Date().toISOString().split('T')[0];
  const items = await getContentItems();
  const todayItems = items.filter(i => i.publishedAt?.startsWith(today));

  const byPlatform: DailyReport['byPlatform'] = {};

  for (const item of todayItems) {
    if (!byPlatform[item.platform]) {
      byPlatform[item.platform] = { published: 0, views: 0, likes: 0, subscribers: 0 };
    }
    const ps = byPlatform[item.platform]!;
    ps.published++;
    ps.views += item.analytics?.views || 0;
    ps.likes += item.analytics?.likes || 0;
  }

  const report: DailyReport = {
    date: today,
    published: todayItems.filter(i => i.status === 'published').length,
    failed: todayItems.filter(i => i.status === 'failed').length,
    totalViews: todayItems.reduce((s, i) => s + (i.analytics?.views || 0), 0),
    totalLikes: todayItems.reduce((s, i) => s + (i.analytics?.likes || 0), 0),
    totalComments: todayItems.reduce((s, i) => s + (i.analytics?.comments || 0), 0),
    byPlatform,
    topContent: todayItems.sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0))[0],
  };

  return report;
}
