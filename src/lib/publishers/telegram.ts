// ============================================================
// Content Factory — Telegram Publisher
// ============================================================
import type { ContentItem, TelegramConfig, PublishResult, DailyReport } from '../types';

const TELEGRAM_API = 'https://api.telegram.org/bot';

async function telegramApi(token: string, method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || JSON.stringify(data)}`);
  }
  return data.result;
}

// --- Publishing ---
export async function publishToTelegram(item: ContentItem, config: TelegramConfig): Promise<PublishResult> {
  try {
    let result: unknown;

    if (item.imageUrl && item.format !== 'text') {
      // Photo with caption
      result = await telegramApi(config.botToken, 'sendPhoto', {
        chat_id: config.channelId,
        photo: item.imageUrl,
        caption: item.text || item.caption || '',
        parse_mode: 'HTML',
      });
    } else if (item.videoUrl) {
      // Video
      result = await telegramApi(config.botToken, 'sendVideo', {
        chat_id: config.channelId,
        video: item.videoUrl,
        caption: item.caption || item.text || '',
        parse_mode: 'HTML',
      });
    } else if (item.mediaUrls && item.mediaUrls.length > 1) {
      // Media group (carousel)
      const media = item.mediaUrls.map((url, i) => ({
        type: 'photo' as const,
        media: url,
        ...(i === 0 ? { caption: item.text || '', parse_mode: 'HTML' } : {}),
      }));
      result = await telegramApi(config.botToken, 'sendMediaGroup', {
        chat_id: config.channelId,
        media,
      });
    } else {
      // Text only
      result = await telegramApi(config.botToken, 'sendMessage', {
        chat_id: config.channelId,
        text: item.text || '',
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      });
    }

    const messageId = (result as { message_id?: number })?.message_id;
    const channelName = config.channelId.replace(/^@/, '').replace(/^-100/, '');

    return {
      success: true,
      platform: 'telegram',
      url: messageId ? `https://t.me/${channelName}/${messageId}` : undefined,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      platform: 'telegram',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

// --- Reports ---
export async function sendTelegramReport(report: DailyReport, config: TelegramConfig): Promise<void> {
  const platformStats = Object.entries(report.byPlatform || {})
    .map(([platform, stats]) => {
      if (!stats) return '';
      return `  <b>${platform}</b>: ${stats.published} постов | ${stats.views} просмотров | ${stats.likes} лайков`;
    })
    .filter(Boolean)
    .join('\n');

  const text = `📊 <b>Отчёт за ${report.date}</b>

✅ Опубликовано: <b>${report.published}</b>
❌ Ошибок: <b>${report.failed}</b>

👁 Просмотров: <b>${report.totalViews}</b>
❤️ Лайков: <b>${report.totalLikes}</b>
💬 Комментариев: <b>${report.totalComments}</b>

📱 По платформам:
${platformStats || '  Нет данных'}

${report.topContent ? `🏆 Лучший пост: <a href="${report.topContent.publishedUrl || '#'}">${report.topContent.title}</a>` : ''}`;

  await telegramApi(config.botToken, 'sendMessage', {
    chat_id: config.reportChatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

export async function sendTelegramNotification(message: string, config: TelegramConfig): Promise<void> {
  await telegramApi(config.botToken, 'sendMessage', {
    chat_id: config.reportChatId,
    text: message,
    parse_mode: 'HTML',
  });
}

// --- Send PNG album (carousel slides as images) to admin ---
// Uses multipart/form-data to upload image buffers directly
export async function sendCarouselAlbum(
  images: Buffer[],
  caption: string,
  config: TelegramConfig
): Promise<void> {
  if (images.length === 0) return;

  // Telegram album max = 10 photos
  const chunks: Buffer[][] = [];
  for (let i = 0; i < images.length; i += 10) {
    chunks.push(images.slice(i, i + 10));
  }

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    const form = new FormData();
    form.append('chat_id', config.reportChatId);

    // Build media array (caption only on first photo of first chunk)
    const media = chunk.map((_, i) => {
      const filename = `slide_${chunkIdx * 10 + i + 1}.png`;
      const isFirstOfFirst = chunkIdx === 0 && i === 0;
      return {
        type: 'photo' as const,
        media: `attach://${filename}`,
        ...(isFirstOfFirst ? { caption, parse_mode: 'HTML' as const } : {}),
      };
    });

    form.append('media', JSON.stringify(media));

    // Attach each image as a file
    chunk.forEach((buf, i) => {
      const filename = `slide_${chunkIdx * 10 + i + 1}.png`;
      // Convert Node Buffer to a Blob (Node 18+ supports Blob)
      const blob = new Blob([new Uint8Array(buf)], { type: 'image/png' });
      form.append(filename, blob, filename);
    });

    const res = await fetch(`${TELEGRAM_API}${config.botToken}/sendMediaGroup`, {
      method: 'POST',
      body: form,
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram sendMediaGroup error: ${data.description || JSON.stringify(data)}`);
    }
  }
}

// --- Send TikTok Carousel Draft to Admin ---
export async function sendTikTokDraft(
  carousel: {
    title: string;
    slides: Array<{ text: string; description: string; slideNumber: number }>;
    caption: string;
    hashtags: string[];
    rubric?: string;
    zodiacSign?: string;
  },
  config: TelegramConfig
): Promise<void> {
  const slidesText = carousel.slides
    .map(s => `<b>[${s.slideNumber}]</b> ${s.text}${s.description ? `\n<i>${s.description}</i>` : ''}`)
    .join('\n\n');

  const text = [
    '<b>Черновик TikTok-карусели</b>',
    '',
    `<b>${carousel.title}</b>`,
    carousel.rubric ? `${carousel.rubric}${carousel.zodiacSign ? ` | ${carousel.zodiacSign}` : ''}` : '',
    '',
    slidesText,
    '',
    `<b>Подпись:</b> ${carousel.caption}`,
    carousel.hashtags.join(' '),
    '',
    'Скопируй тексты слайдов, собери карусель в TikTok, добавь трендовый звук.',
  ].filter(Boolean).join('\n');

  await telegramApi(config.botToken, 'sendMessage', {
    chat_id: config.reportChatId,
    text,
    parse_mode: 'HTML',
  });
}

// --- Send carousel as PNG album + text fallback ---
export async function sendCarouselAsImages(
  carousel: {
    title: string;
    slides: Array<{ text: string; description: string; slideNumber: number }>;
    caption: string;
    hashtags: string[];
    rubric?: string;
    zodiacSign?: string;
    zodiacSign2?: string;
  },
  config: TelegramConfig
): Promise<void> {
  try {
    const { renderCarousel } = await import('../generators/slide-renderer');
    const images = await renderCarousel(
      carousel.slides.map(s => ({
        text: s.text,
        description: s.description || undefined,
        slideNumber: s.slideNumber,
        totalSlides: carousel.slides.length,
        zodiacSign: carousel.zodiacSign as never,
        zodiacSign2: carousel.zodiacSign2 as never,
      }))
    );

    // title\n\ncaption\n\nhashtags — no labels
    const albumCaption = [
      carousel.title,
      '',
      carousel.caption,
      '',
      carousel.hashtags.join(' '),
    ].join('\n').slice(0, 1024);

    await sendCarouselAlbum(images, albumCaption, config);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await telegramApi(config.botToken, 'sendMessage', {
      chat_id: config.reportChatId,
      text: `⚠️ Ошибка при генерации карусели:\n<code>${msg.slice(0, 500)}</code>`,
      parse_mode: 'HTML',
    }).catch(() => {});
    throw error;
  }
}

// --- Health Check ---
export async function checkTelegramConnection(config: TelegramConfig): Promise<{ ok: boolean; botName?: string; error?: string }> {
  try {
    const result = await telegramApi(config.botToken, 'getMe', {}) as { username?: string };
    return { ok: true, botName: result.username };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// --- Channel Stats ---
export async function getTelegramChannelInfo(config: TelegramConfig): Promise<{
  title: string;
  memberCount: number;
} | null> {
  try {
    const result = await telegramApi(config.botToken, 'getChat', { chat_id: config.channelId }) as {
      title?: string;
    };
    const countResult = await telegramApi(config.botToken, 'getChatMemberCount', { chat_id: config.channelId }) as number;
    return {
      title: result.title || 'Unknown',
      memberCount: countResult,
    };
  } catch {
    return null;
  }
}
