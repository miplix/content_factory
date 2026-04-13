// ============================================================
// Vercel Cron — Daily Pipeline (YupSoul)
// Runs every day: generates content, publishes, sends report
// Cron: 0 8 * * * (8:00 AM UTC = 11:00 MSK)
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { runDailyPipeline, generateDailyReport } from '@/lib/orchestrator';
import { validateConfig } from '@/lib/validator';
import { sendTelegramReport, sendTelegramNotification } from '@/lib/publishers/telegram';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min max on Vercel Pro, 60s on Hobby

export async function GET(request: Request) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = loadConfig();

  // Step 1: Spock validates before doing anything
  const validation = validateConfig(config);
  if (!validation.valid) {
    if (config.platforms.telegram) {
      await sendTelegramNotification(
        `\uD83D\uDD96 SPOCK: Config invalid!\n\n${validation.errors.join('\n')}`,
        config.platforms.telegram
      );
    }
    return NextResponse.json({
      status: 'error',
      message: 'Config validation failed',
      errors: validation.errors,
    }, { status: 400 });
  }

  try {
    // Step 2: Run pipeline
    const results = await runDailyPipeline(config);

    // Step 3: Generate and send report
    const report = await generateDailyReport(config);

    if (config.platforms.telegram) {
      await sendTelegramReport(report, config.platforms.telegram);

      if (results.errors.length > 0) {
        await sendTelegramNotification(
          `\u26A0\uFE0F Errors today:\n\n${results.errors.join('\n')}`,
          config.platforms.telegram
        );
      }
    }

    return NextResponse.json({
      status: 'ok',
      ...results,
      report: {
        published: report.published,
        failed: report.failed,
        totalViews: report.totalViews,
      },
    });
  } catch (error) {
    if (config.platforms.telegram) {
      await sendTelegramNotification(
        `\uD83D\uDD34 Critical pipeline error:\n\n${error instanceof Error ? error.message : String(error)}`,
        config.platforms.telegram
      );
    }

    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
