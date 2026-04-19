// ============================================================
// Vercel Cron — Daily TikTok Content (YupSoul)
// Generates 2 TikTok carousels and sends them to Telegram bot
// Cron: 0 8 * * * (8:00 AM UTC = 11:00 MSK)
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { validateConfig } from '@/lib/validator';
import { generateTikTokCarousel, generateAllSignsCarousel } from '@/lib/generators/tiktok-carousel';
import { sendCarouselAsImages, sendTelegramNotification } from '@/lib/publishers/telegram';
import { ZODIAC_SIGNS, RUBRIC_RU } from '@/lib/types';
import { getDeliveryHours } from '@/lib/db';
import type { ContentRubric, ZodiacSign } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = loadConfig();

  // Check if current Tbilisi hour is a scheduled delivery hour
  const tbilisiHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tbilisi', hour: 'numeric', hour12: false }),
    10,
  );
  const deliveryHours = getDeliveryHours();
  if (!deliveryHours.includes(tbilisiHour)) {
    return NextResponse.json({ status: 'skipped', reason: `hour ${tbilisiHour} not in schedule [${deliveryHours}]` });
  }

  // Spock validates
  const validation = validateConfig(config);
  if (!validation.valid) {
    if (config.platforms.telegram) {
      await sendTelegramNotification(
        `SPOCK: Config invalid!\n${validation.errors.join('\n')}`,
        config.platforms.telegram
      );
    }
    return NextResponse.json({ status: 'error', errors: validation.errors }, { status: 400 });
  }

  if (!config.platforms.telegram) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 400 });
  }

  try {
    // Pick rubrics and signs for today (rotate daily)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const rubrics: ContentRubric[] = [
      'zodiac_sound', 'compatibility', 'zodiac_memes', 'signs_as_genres',
      'astro_facts', 'gift', 'daily_energy', 'signs_in_business',
      'month_ahead', 'zodiac_life_examples',
    ];
    const results: string[] = [];

    // Every 3rd day include one all-twelve carousel instead of second regular
    const includeAllTwelve = dayOfYear % 3 === 0;

    // Generate 2 carousels
    for (let i = 0; i < 2; i++) {
      try {
        if (i === 1 && includeAllTwelve) {
          const carousel = await generateAllSignsCarousel({ config });
          await sendCarouselAsImages(carousel, config.platforms.telegram);
          results.push(`ok: Все 12 знаков — ${carousel.title}`);
        } else {
          const rubric = rubrics[(dayOfYear * 2 + i) % rubrics.length];
          const sign = ZODIAC_SIGNS[(dayOfYear * 2 + i) % 12];
          const sign2 = rubric === 'compatibility' ? ZODIAC_SIGNS[(dayOfYear * 2 + i + 6) % 12] : undefined;

          const carousel = await generateTikTokCarousel({ rubric, zodiacSign: sign, zodiacSign2: sign2, config });
          await sendCarouselAsImages(carousel, config.platforms.telegram);
          results.push(`ok: ${RUBRIC_RU[rubric]} ${sign}`);
        }
      } catch (e) {
        results.push(`fail: слот ${i + 1} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Summary
    const okCount = results.filter(r => r.startsWith('ok')).length;
    await sendTelegramNotification(
      `✅ Готово: ${okCount}/2 карусели отправлены (${tbilisiHour}:00 Тбилиси)`,
      config.platforms.telegram
    );

    return NextResponse.json({ status: 'ok', results });
  } catch (error) {
    if (config.platforms.telegram) {
      await sendTelegramNotification(
        `Cron error: ${error instanceof Error ? error.message : String(error)}`,
        config.platforms.telegram
      );
    }
    return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 });
  }
}
