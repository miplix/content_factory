// ============================================================
// Telegram Bot Webhook — YupSoul Content Factory
// Русифицированный интерфейс с упрощённым меню
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { getActiveLLMProvider, getActiveImageProvider, getEnabledPlatforms } from '@/lib/config';
import { validateSystem } from '@/lib/validator';
import { generateTikTokCarousel } from '@/lib/generators/tiktok-carousel';
import { sendCarouselAsImages } from '@/lib/publishers/telegram';
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

// --- Главное меню (всегда на экране) ---
const MAIN_MENU = {
  keyboard: [
    [{ text: 'Карусель по знаку' }, { text: 'Совместимость' }],
    [{ text: 'Случайная' }, { text: 'Рубрика' }],
    [{ text: 'Статус' }, { text: 'Помощь' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// --- Клавиатура знаков зодиака (4×3) ---
function zodiacKeyboard(prefix: string) {
  const cells = ZODIAC_SIGNS.map(s => ({
    text: `${ZODIAC_EMOJI[s]} ${ZODIAC_RU[s]}`,
    callback_data: `${prefix}:${s}`,
  }));
  return {
    inline_keyboard: [cells.slice(0, 4), cells.slice(4, 8), cells.slice(8, 12)],
  };
}

// --- Клавиатура рубрик ---
const BOT_RUBRICS: ContentRubric[] = [
  'zodiac_sound',
  'compatibility',
  'zodiac_memes',
  'signs_as_genres',
  'gift',
  'astro_facts',
  'daily_energy',
];

function rubricKeyboard() {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < BOT_RUBRICS.length; i += 2) {
    rows.push(
      BOT_RUBRICS.slice(i, i + 2).map(r => ({
        text: RUBRIC_RU[r],
        callback_data: `rub:${r}`,
      })),
    );
  }
  return { inline_keyboard: rows };
}

// --- Соответствие нажатий на reply-клавиатуре → команды ---
const MENU_ALIASES: Record<string, string> = {
  'карусель по знаку': '/carousel',
  'карусель': '/carousel',
  'совместимость': '/compat',
  'случайная': '/random',
  'рубрика': '/rubric',
  'статус': '/status',
  'помощь': '/help',
};

const HELP_TEXT = [
  '<b>YupSoul — фабрика контента</b>',
  '',
  'Выбери действие в меню снизу или используй команды:',
  '',
  '/carousel — карусель по знаку зодиака',
  '/compat — совместимость двух знаков',
  '/rubric — карусель по выбранной рубрике',
  '/random — случайная карусель',
  '/meme — мем-карусель',
  '/gift — карусель «Подарок»',
  '/status — статус системы',
  '/validate — диагностика',
].join('\n');

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

// Состояние для двухшаговых сценариев (совместимость)
const pendingCompat: Map<number, { sign1: ZodiacSign }> = new Map();

export async function POST(request: Request) {
  try {
    const update = await request.json() as TelegramUpdate;
    const config = loadConfig();
    if (!config.platforms.telegram) return NextResponse.json({ ok: true });

    const token = config.platforms.telegram.botToken;
    const adminChatId = config.platforms.telegram.reportChatId;

    // --- Нажатия inline-кнопок ---
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat.id;
      const data = cb.data || '';

      if (!chatId || String(chatId) !== adminChatId) {
        await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id });
        return NextResponse.json({ ok: true });
      }

      await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Генерирую…' });

      const [prefix, value] = data.split(':');

      if (prefix === 'car') {
        const sign = value as ZodiacSign;
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${ZODIAC_EMOJI[sign]} Генерирую карусель для знака «${ZODIAC_RU[sign]}»…`,
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
        const sign1 = value as ZodiacSign;
        pendingCompat.set(chatId, { sign1 });
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `Первый знак: ${ZODIAC_EMOJI[sign1]} ${ZODIAC_RU[sign1]}\nТеперь выбери второй:`,
          reply_markup: zodiacKeyboard('cmp2'),
        });
        return NextResponse.json({ ok: true });
      }

      if (prefix === 'cmp2') {
        const sign2 = value as ZodiacSign;
        const pending = pendingCompat.get(chatId);
        const sign1 = pending?.sign1 || 'aries';
        pendingCompat.delete(chatId);

        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${ZODIAC_EMOJI[sign1]} ${ZODIAC_RU[sign1]} + ${ZODIAC_EMOJI[sign2]} ${ZODIAC_RU[sign2]} — генерирую…`,
        });

        const carousel = await generateTikTokCarousel({
          rubric: 'compatibility',
          zodiacSign: sign1,
          zodiacSign2: sign2,
          config,
        });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        return NextResponse.json({ ok: true });
      }

      if (prefix === 'rub') {
        const rubric = value as ContentRubric;
        if (rubric === 'signs_as_genres' || rubric === 'daily_energy') {
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `Генерирую карусель «${RUBRIC_RU[rubric]}»…`,
          });
          const carousel = await generateTikTokCarousel({ rubric, config });
          await sendCarouselAsImages(carousel, config.platforms.telegram!);
        } else {
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `Рубрика «${RUBRIC_RU[rubric]}». Выбери знак:`,
            reply_markup: zodiacKeyboard(`gen_${rubric}`),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (prefix.startsWith('gen_')) {
        const rubric = prefix.replace('gen_', '') as ContentRubric;
        const sign = value as ZodiacSign;
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${ZODIAC_EMOJI[sign]} «${RUBRIC_RU[rubric]}» для знака «${ZODIAC_RU[sign]}» — генерирую…`,
        });

        const carousel = await generateTikTokCarousel({ rubric, zodiacSign: sign, config });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // --- Текстовые сообщения ---
    const message = update.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const chatId = String(message.chat.id);
    if (chatId !== adminChatId) return NextResponse.json({ ok: true });

    const raw = message.text.trim();
    const lower = raw.toLowerCase();
    const command = lower.startsWith('/')
      ? lower.split(/[\s@]/)[0]
      : MENU_ALIASES[lower] || '';

    switch (command) {
      case '/start': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: HELP_TEXT,
          parse_mode: 'HTML',
          reply_markup: MAIN_MENU,
        });
        break;
      }

      case '/help': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: HELP_TEXT,
          parse_mode: 'HTML',
        });
        break;
      }

      case '/carousel': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Выбери знак зодиака:',
          reply_markup: zodiacKeyboard('car'),
        });
        break;
      }

      case '/compat': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Совместимость. Выбери первый знак:',
          reply_markup: zodiacKeyboard('cmp1'),
        });
        break;
      }

      case '/rubric': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Выбери рубрику:',
          reply_markup: rubricKeyboard(),
        });
        break;
      }

      case '/meme': {
        const randomSign = ZODIAC_SIGNS[Math.floor(Math.random() * 12)];
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Генерирую мем-карусель…',
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
          text: 'Генерирую карусель «Подарок»…',
        });
        const carousel = await generateTikTokCarousel({
          rubric: 'gift',
          config,
        });
        await sendCarouselAsImages(carousel, config.platforms.telegram!);
        break;
      }

      case '/random': {
        const rub = BOT_RUBRICS[Math.floor(Math.random() * BOT_RUBRICS.length)];
        const sign = ZODIAC_SIGNS[Math.floor(Math.random() * 12)];
        const sign2 = rub === 'compatibility' ? ZODIAC_SIGNS[Math.floor(Math.random() * 12)] : undefined;

        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `Случайная карусель: «${RUBRIC_RU[rub]}» ${ZODIAC_EMOJI[sign]} ${ZODIAC_RU[sign]}…`,
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
            '<b>YupSoul — статус</b>',
            '',
            `Модель текста: <b>${llm || 'не настроено'}</b>`,
            `Модель картинок: <b>${img || 'placeholder'}</b>`,
            `Платформы: <b>${platforms.join(', ') || 'нет'}</b>`,
            '',
            `Запланировано: <b>${planned}</b>`,
            `Сгенерировано: <b>${generated}</b>`,
            `Опубликовано: <b>${published}</b>`,
            `Ошибок: <b>${failed}</b>`,
            `Всего: <b>${items.length}</b>`,
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
        if (raw.startsWith('/')) {
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: 'Неизвестная команда. Нажми «Помощь» или отправь /help.',
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
