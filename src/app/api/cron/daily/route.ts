// ============================================================
// Vercel Cron — Daily TikTok Content (YupSoul)
// Generates 2 TikTok carousels and sends them to Telegram bot
// Cron: 0 8 * * * (8:00 AM UTC = 11:00 MSK)
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { validateConfig } from '@/lib/validator';
import { generateTikTokCarousel } from '@/lib/generators/tiktok-carousel';
import { sendTikTokDraft, sendTelegramNotification } from '@/lib/publishers/telegram';
import { ZODIAC_SIGNS, RUBRIC_RU } from '@/lib/types';
import type { ContentRubric, ZodiacSign } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = loadConfig();

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
    const rubrics: ContentRubric[] = ['zodiac_sound', 'compatibility', 'zodiac_memes', 'signs_as_genres', 'astro_facts', 'gift', 'daily_energy'];
    const results: string[] = [];

    // Generate 2 carousels
    for (let i = 0; i < 2; i++) {
      const rubric = rubrics[(dayOfYear * 2 + i) % rubrics.length];
      const sign = ZODIAC_SIGNS[(dayOfYear * 2 + i) % 12];
      const sign2 = rubric === 'compatibility' ? ZODIAC_SIGNS[(dayOfYear * 2 + i + 6) % 12] : undefined;

      try {
        const carousel = await generateTikTokCarousel({
          rubric,
          zodiacSign: sign,
          zodiacSign2: sign2,
          config,
        });

        await sendTikTokDraft(carousel, config.platforms.telegram);
        results.push(`ok: ${RUBRIC_RU[rubric]} ${sign}`);
      } catch (e) {
        results.push(`fail: ${RUBRIC_RU[rubric]} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Summary
    await sendTelegramNotification(
      `Daily content ready! ${results.filter(r => r.startsWith('ok')).length}/2 karuselej sgenerovano.`,
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
