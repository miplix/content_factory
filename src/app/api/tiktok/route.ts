// ============================================================
// TikTok Content API — генерация и публикация каруселей
// POST /api/tiktok — генерация карусели
// POST /api/tiktok?action=week — генерация на неделю
// POST /api/tiktok?action=send — генерация + отправка в Telegram
// POST /api/tiktok?action=publish — публикация в TikTok
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { generateTikTokCarousel, generateWeeklyCarousels } from '@/lib/generators/tiktok-carousel';
import { generateImage } from '@/lib/generators/image';
import { validateContentItem } from '@/lib/validator';
import { upsertContentItem, generateId } from '@/lib/db';
import type { ContentItem, ContentRubric, ZodiacSign } from '@/lib/types';
import { ZODIAC_SIGNS } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'generate';
    const config = loadConfig();

    switch (action) {
      case 'generate': {
        const body = await request.json();
        const {
          rubric = 'zodiac_sound' as ContentRubric,
          zodiacSign,
          zodiacSign2,
          generateImages = false,
        } = body;

        // Генерация карусели
        const carousel = await generateTikTokCarousel({
          rubric,
          zodiacSign,
          zodiacSign2,
          config,
        });

        // Генерация изображений для слайдов (если запрошено)
        let imageUrls: string[] = [];
        if (generateImages) {
          const imagePromises = carousel.slides.map(slide =>
            generateImage({
              topic: slide.text,
              platform: 'tiktok',
              brand: config.brand,
              zodiacSign: carousel.zodiacSign,
              rubric: carousel.rubric,
              config,
            }).then(r => r.imageUrl).catch(() => '')
          );
          imageUrls = await Promise.all(imagePromises);
        }

        // Сохраняем как контент-айтем
        const item: ContentItem = {
          id: generateId(),
          title: carousel.title,
          topic: `TikTok: ${carousel.title}`,
          platform: 'tiktok',
          format: 'carousel',
          status: 'generated',
          text: carousel.slides.map(s => s.text).join('\n\n'),
          caption: carousel.caption,
          hashtags: carousel.hashtags,
          mediaUrls: imageUrls.filter(Boolean),
          rubric: carousel.rubric,
          zodiacSign: carousel.zodiacSign,
          scheduledAt: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const validation = validateContentItem(item);
        await upsertContentItem(item);

        return NextResponse.json({
          status: 'ok',
          carousel,
          item,
          validation: { valid: validation.valid, warnings: validation.warnings },
          imageUrls,
        });
      }

      case 'week': {
        // Генерация 14 каруселей на неделю (2/день)
        const carousels = await generateWeeklyCarousels(config);

        const items: ContentItem[] = [];
        const today = new Date();

        for (let i = 0; i < carousels.length; i++) {
          const carousel = carousels[i];
          const dayOffset = Math.floor(i / 2);
          const date = new Date(today);
          date.setDate(today.getDate() + dayOffset);

          const item: ContentItem = {
            id: generateId(),
            title: carousel.title,
            topic: `TikTok: ${carousel.title}`,
            platform: 'tiktok',
            format: 'carousel',
            status: 'planned',
            text: carousel.slides.map(s => s.text).join('\n\n'),
            caption: carousel.caption,
            hashtags: carousel.hashtags,
            rubric: carousel.rubric,
            zodiacSign: carousel.zodiacSign,
            scheduledAt: date.toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await upsertContentItem(item);
          items.push(item);
        }

        return NextResponse.json({
          status: 'ok',
          count: carousels.length,
          items: items.map(i => ({
            id: i.id,
            title: i.title,
            scheduledAt: i.scheduledAt,
            rubric: i.rubric,
            zodiacSign: i.zodiacSign,
          })),
        });
      }

      case 'send': {
        // Генерация + отправка в Telegram для ручного постинга
        const sendBody = await request.json();
        const {
          rubric: sendRubric = 'zodiac_sound' as ContentRubric,
          zodiacSign: sendSign,
          zodiacSign2: sendSign2,
        } = sendBody;

        if (!config.platforms.telegram?.reportChatId) {
          return NextResponse.json({
            error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_REPORT_CHAT_ID required for sending drafts',
          }, { status: 400 });
        }

        const sendCarousel = await generateTikTokCarousel({
          rubric: sendRubric,
          zodiacSign: sendSign,
          zodiacSign2: sendSign2,
          config,
        });

        const { sendTikTokDraft } = await import('@/lib/publishers/telegram');
        await sendTikTokDraft(sendCarousel, config.platforms.telegram);

        return NextResponse.json({
          status: 'ok',
          message: 'Carousel sent to Telegram',
          carousel: sendCarousel,
        });
      }

      case 'publish': {
        const body = await request.json();
        const { itemId } = body;

        if (!itemId) {
          return NextResponse.json({ error: 'itemId required' }, { status: 400 });
        }

        if (!config.platforms.tiktok) {
          return NextResponse.json({
            error: 'TikTok not configured. Set TIKTOK_ACCESS_TOKEN and TIKTOK_OPEN_ID in .env.local',
          }, { status: 400 });
        }

        const { publishToTikTok } = await import('@/lib/publishers/tiktok');
        const { getItemById } = await import('@/lib/db');

        const item = await getItemById(itemId);
        if (!item) {
          return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const result = await publishToTikTok(item, config.platforms.tiktok);
        item.status = result.success ? 'published' : 'failed';
        item.publishedUrl = result.url;
        item.error = result.error;
        await upsertContentItem(item);

        return NextResponse.json({ status: result.success ? 'ok' : 'error', result, item });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// GET — показать статус TikTok и список контента
export async function GET() {
  const config = loadConfig();
  const { getContentItems } = await import('@/lib/db');

  const allItems = await getContentItems({ platform: 'tiktok' });
  const planned = allItems.filter(i => i.status === 'planned');
  const generated = allItems.filter(i => i.status === 'generated');
  const published = allItems.filter(i => i.status === 'published');

  let tiktokStatus = 'not_configured';
  if (config.platforms.tiktok) {
    const { checkTikTokConnection } = await import('@/lib/publishers/tiktok');
    const check = await checkTikTokConnection(config.platforms.tiktok);
    tiktokStatus = check.ok ? `connected (${check.username})` : `error: ${check.error}`;
  }

  return NextResponse.json({
    platform: 'tiktok',
    status: tiktokStatus,
    content: {
      planned: planned.length,
      generated: generated.length,
      published: published.length,
      total: allItems.length,
    },
    items: allItems.slice(-20).map(i => ({
      id: i.id,
      title: i.title,
      status: i.status,
      rubric: i.rubric,
      zodiacSign: i.zodiacSign,
      scheduledAt: i.scheduledAt,
      publishedUrl: i.publishedUrl,
    })),
    usage: {
      generate: 'POST /api/tiktok { rubric, zodiacSign, generateImages }',
      week: 'POST /api/tiktok?action=week',
      publish: 'POST /api/tiktok?action=publish { itemId }',
    },
  });
}
