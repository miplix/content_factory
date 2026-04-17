// ============================================================
// Telegram Bot Webhook — YupSoul Content Factory
// Commands with inline buttons for zodiac sign selection
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { getActiveLLMProvider, getActiveImageProvider, getEnabledPlatforms } from '@/lib/config';
import { validateSystem } from '@/lib/validator';
import { buildDailyReport, formatReportForTelegram, fetchAllPlatformStats } from '@/lib/analytics';
import { generateTikTokCarousel } from '@/lib/generators/tiktok-carousel';
import { sendTikTokDraft, sendCarouselAsImages } from '@/lib/publishers/telegram';
import { getContentItems } from '@/lib/db';
import { ZODIAC_RU, ZODIAC_EMOJI, ZODIAC_SIGNS, RUBRIC_RU } from '@/lib/types';
import type { ZodiacSign, ContentRubric } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TELEGRAM_API = 'https://api.telegram.org/bot';

async function tgApi(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// --- Zodiac keyboard (4x3 grid) ---
function zodiacKeyboard(prefix: string) {
  return {
    inline_keyboard: [
      [
        { text: `${ZODIAC_EMOJI.aries} Ovn`, callback_data: `${prefix}:aries` },
        { text: `${ZODIAC_EMOJI.taurus} Tel`, callback_data: `${prefix}:taurus` },
        { text: `${ZODIAC_EMOJI.gemini} Bliz`, callback_data: `${prefix}:gemini` },
        { text: `${ZODIAC_EMOJI.cancer} Rak`, callback_data: `${prefix}:cancer` },
      ],
      [
        { text: `${ZODIAC_EMOJI.leo} Lev`, callback_data: `${prefix}:leo` },
        { text: `${ZODIAC_EMOJI.virgo} Deva`, callback_data: `${prefix}:virgo` },
        { text: `${ZODIAC_EMOJI.libra} Vesy`, callback_data: `${prefix}:libra` },
        { text: `${ZODIAC_EMOJI.scorpio} Skorp`, callback_data: `${prefix}:scorpio` },
      ],
      [
        { text: `${ZODIAC_EMOJI.sagittarius} Strel`, callback_data: `${prefix}:sagittarius` },
        { text: `${ZODIAC_EMOJI.capricorn} Kozr`, callback_data: `${prefix}:capricorn` },
        { text: `${ZODIAC_EMOJI.aquarius} Vodol`, callback_data: `${prefix}:aquarius` },
        { text: `${ZODIAC_EMOJI.pisces} Ryby`, callback_data: `${prefix}:pisces` },
      ],
    ],
  };
}

// --- Rubric keyboard ---
function rubricKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Zvuk znaka', callback_data: 'rub:zodiac_sound' },
        { text: 'Sovmestimost', callback_data: 'rub:compatibility' },
      ],
      [
        { text: 'Memy', callback_data: 'rub:zodiac_memes' },
        { text: 'Zhanry', callback_data: 'rub:signs_as_genres' },
      ],
      [
        { text: 'Podarok', callback_data: 'rub:gift' },
        { text: 'Fakty', callback_data: 'rub:astro_facts' },
      ],
      [
        { text: 'Energiya dnya', callback_data: 'rub:daily_energy' },
      ],
    ],
  };
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { id: number; first_name?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
}

// State for multi-step flows (compatibility needs 2 signs)
const pendingCompat: Map<number, { sign1: ZodiacSign }> = new Map();

export async function POST(request: Request) {
  try {
    const update = await request.json() as TelegramUpdate;
    const config = loadConfig();
    if (!config.platforms.telegram) return NextResponse.json({ ok: true });

    const token = config.platforms.telegram.botToken;
    const adminChatId = config.platforms.telegram.reportChatId;

    // --- Handle callback_query (button presses) ---
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat.id;
      const data = cb.data || '';

      if (!chatId || String(chatId) !== adminChatId) {
        await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id });
        return NextResponse.json({ ok: true });
      }

      // Answer callback to remove loading state
      await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Generiruju...' });

      // Parse callback data
      const [prefix, value] = data.split(':');

      if (prefix === 'car') {
        // Carousel for specific sign
        const sign = value as ZodiacSign;
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${ZODIAC_EMOJI[sign]} Generiruju karusel dlya ${ZODIAC_RU[sign]}...`,
        });

        const carousel = await generateTikTokCarousel({
          rubric: 'zodiac_sound',
          zodiacSign: sign,
          config,
        });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        return NextResponse.json({ ok: true });
      }

      if (prefix === 'cmp1') {
        // Compatibility — first sign selected, ask for second
        const sign1 = value as ZodiacSign;
        pendingCompat.set(chatId, { sign1 });
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${ZODIAC_EMOJI[sign1]} ${ZODIAC_RU[sign1]} + ...?\nVyberi vtoroj znak:`,
          reply_markup: zodiacKeyboard('cmp2'),
        });
        return NextResponse.json({ ok: true });
      }

      if (prefix === 'cmp2') {
        // Compatibility — second sign selected, generate
        const sign2 = value as ZodiacSign;
        const pending = pendingCompat.get(chatId);
        const sign1 = pending?.sign1 || 'aries';
        pendingCompat.delete(chatId);

        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${ZODIAC_EMOJI[sign1 as ZodiacSign]} ${ZODIAC_RU[sign1 as ZodiacSign]} + ${ZODIAC_EMOJI[sign2]} ${ZODIAC_RU[sign2]} — generiruju...`,
        });

        const carousel = await generateTikTokCarousel({
          rubric: 'compatibility',
          zodiacSign: sign1 as ZodiacSign,
          zodiacSign2: sign2,
          config,
        });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        return NextResponse.json({ ok: true });
      }

      if (prefix === 'rub') {
        // Rubric selected — ask for sign
        const rubric = value as ContentRubric;
        if (rubric === 'signs_as_genres' || rubric === 'daily_energy') {
          // These don't need a specific sign
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `Generiruju "${RUBRIC_RU[rubric]}"...`,
          });
          const carousel = await generateTikTokCarousel({ rubric, config });
          await sendCarouselAsImages(carousel, config.platforms.telegram!);
        } else {
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `Vyberi znak dlya "${RUBRIC_RU[rubric]}":`,
            reply_markup: zodiacKeyboard(`gen_${rubric}`),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (prefix.startsWith('gen_')) {
        // Rubric + sign — generate
        const rubric = prefix.replace('gen_', '') as ContentRubric;
        const sign = value as ZodiacSign;
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${ZODIAC_EMOJI[sign]} Generiruju "${RUBRIC_RU[rubric]}" dlya ${ZODIAC_RU[sign]}...`,
        });

        const carousel = await generateTikTokCarousel({ rubric, zodiacSign: sign, config });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // --- Handle text messages ---
    const message = update.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const chatId = String(message.chat.id);
    if (chatId !== adminChatId) return NextResponse.json({ ok: true });

    const command = message.text.split(' ')[0].toLowerCase();

    switch (command) {
      case '/start':
      case '/help': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: [
            '<b>YupSoul Content Factory</b>',
            '',
            'Komandy:',
            '/carousel — karusel dlya znaka zodiaka',
            '/compat — sovmestimost dvuh znakov',
            '/rubric — vybrat rubriku',
            '/meme — mem-karusel',
            '/gift — karusel "podarok"',
            '/random — sluchajnaja karusel',
            '/status — status zavoda',
            '/validate — proverka Spokom',
          ].join('\n'),
          parse_mode: 'HTML',
        });
        break;
      }

      case '/carousel': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Vyberi znak zodiaka:',
          reply_markup: zodiacKeyboard('car'),
        });
        break;
      }

      case '/compat': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Sovmestimost — vyberi PERVYJ znak:',
          reply_markup: zodiacKeyboard('cmp1'),
        });
        break;
      }

      case '/rubric': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Vyberi rubriku:',
          reply_markup: rubricKeyboard(),
        });
        break;
      }

      case '/meme': {
        const randomSign = ZODIAC_SIGNS[Math.floor(Math.random() * 12)];
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `Generiruju mem-karusel...`,
        });
        const carousel = await generateTikTokCarousel({
          rubric: 'zodiac_memes',
          zodiacSign: randomSign,
          config,
        });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        break;
      }

      case '/gift': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Generiruju karusel "Podarok"...',
        });
        const carousel = await generateTikTokCarousel({
          rubric: 'gift',
          config,
        });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        break;
      }

      case '/random': {
        const rubrics: ContentRubric[] = ['zodiac_sound', 'compatibility', 'zodiac_memes', 'signs_as_genres', 'astro_facts', 'gift'];
        const rub = rubrics[Math.floor(Math.random() * rubrics.length)];
        const sign = ZODIAC_SIGNS[Math.floor(Math.random() * 12)];
        const sign2 = rub === 'compatibility' ? ZODIAC_SIGNS[Math.floor(Math.random() * 12)] : undefined;

        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `Sluchajnaja karusel: "${RUBRIC_RU[rub]}" ${ZODIAC_EMOJI[sign]} ${ZODIAC_RU[sign]}...`,
        });

        const carousel = await generateTikTokCarousel({
          rubric: rub,
          zodiacSign: sign,
          zodiacSign2: sign2,
          config,
        });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        break;
      }

      case '/status': {
        const items = await getContentItems();
        const published = items.filter(i => i.status === 'published').length;
        const planned = items.filter(i => i.status === 'planned').length;
        const generated = items.filter(i => i.status === 'generated').length;
        const failed = items.filter(i => i.status === 'failed').length;

        const llm = getActiveLLMProvider(config);
        const img = getActiveImageProvider(config);
        const platforms = getEnabledPlatforms(config);

        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: [
            '<b>YupSoul Content Factory — Status</b>',
            '',
            `LLM: <b>${llm || 'ne nastroeno'}</b>`,
            `Kartinki: <b>${img || 'placeholder'}</b>`,
            `Platformy: <b>${platforms.join(', ') || 'net'}</b>`,
            '',
            `Zaplanrovano: <b>${planned}</b>`,
            `Sgenerovano: <b>${generated}</b>`,
            `Opublikovano: <b>${published}</b>`,
            `Oshibok: <b>${failed}</b>`,
            `Vsego: <b>${items.length}</b>`,
          ].join('\n'),
          parse_mode: 'HTML',
        });
        break;
      }

      case '/validate': {
        const { summary } = await validateSystem(config);
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `<pre>${escapeHtml(summary)}</pre>`,
          parse_mode: 'HTML',
        });
        break;
      }

      default: {
        if (message.text.startsWith('/')) {
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: 'Neizvestnaja komanda. /help — spisok komand.',
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
