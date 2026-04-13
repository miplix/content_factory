// ============================================================
// Manual Content Generation API (YupSoul)
// POST /api/generate — generate content for a specific topic
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { generateText } from '@/lib/generators/text';
import { generateImage } from '@/lib/generators/image';
import { validateContentItem } from '@/lib/validator';
import { upsertContentItem, generateId } from '@/lib/db';
import type { ContentFormat, Platform, ContentItem, ContentRubric, ZodiacSign } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, platform, format = 'text', rubric, zodiacSign, publish = false } = body as {
      topic: string;
      platform: Platform;
      format?: ContentFormat;
      rubric?: ContentRubric;
      zodiacSign?: ZodiacSign;
      publish?: boolean;
    };

    if (!topic || !platform) {
      return NextResponse.json({ error: 'topic and platform are required' }, { status: 400 });
    }

    const config = loadConfig();

    // Generate text
    const textResult = await generateText({
      topic,
      platform,
      format,
      brand: config.brand,
      rubric,
      zodiacSign,
      config,
    });

    // Generate image if needed
    let imageUrl: string | undefined;
    if (['image', 'carousel', 'story'].includes(format)) {
      const imageResult = await generateImage({
        topic,
        platform,
        brand: config.brand,
        zodiacSign,
        rubric,
        config,
      });
      imageUrl = imageResult.imageUrl;
    }

    // Create content item
    const item: ContentItem = {
      id: generateId(),
      title: topic,
      topic,
      platform,
      format,
      status: 'generated',
      rubric,
      zodiacSign,
      text: textResult.text,
      caption: textResult.caption,
      hashtags: textResult.hashtags,
      imageUrl,
      scheduledAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate (Spock checks)
    const validation = validateContentItem(item);

    if (!validation.valid) {
      return NextResponse.json({
        status: 'validation_failed',
        item,
        validation,
      }, { status: 422 });
    }

    await upsertContentItem(item);

    // Publish if requested
    if (publish && validation.valid) {
      const { publishContent } = await import('@/lib/publishers');
      const result = await publishContent(item, config);
      item.status = result.success ? 'published' : 'failed';
      item.publishedUrl = result.url;
      item.error = result.error;
      await upsertContentItem(item);
    }

    return NextResponse.json({
      status: 'ok',
      item,
      validation: {
        valid: validation.valid,
        warnings: validation.warnings,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
