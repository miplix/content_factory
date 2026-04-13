// ============================================================
// Vercel Cron — Reports
// Sends daily/weekly/monthly reports to Telegram
// Cron: 0 21 * * * (9 PM UTC — evening report)
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { buildDailyReport, buildWeeklyReport, formatReportForTelegram } from '@/lib/analytics';
import { sendTelegramNotification } from '@/lib/publishers/telegram';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = loadConfig();
  if (!config.platforms.telegram) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 400 });
  }

  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const dayOfMonth = now.getDate();

    // Daily report — every day
    const dailyReport = await buildDailyReport(undefined, config);
    const dailyText = formatReportForTelegram(dailyReport, 'daily');
    await sendTelegramNotification(dailyText, config.platforms.telegram);

    // Weekly report — every Sunday
    if (dayOfWeek === 0) {
      const weeklyReport = await buildWeeklyReport(config);
      const weeklyText = formatReportForTelegram(weeklyReport, 'weekly');
      await sendTelegramNotification(weeklyText, config.platforms.telegram);
    }

    // Monthly report — 1st of month
    if (dayOfMonth === 1) {
      // Reuse weekly report structure for monthly
      const monthlyReport = await buildDailyReport(undefined, config);
      const monthlyText = formatReportForTelegram(monthlyReport, 'monthly');
      await sendTelegramNotification(monthlyText, config.platforms.telegram);
    }

    return NextResponse.json({ status: 'ok', sent: true });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
