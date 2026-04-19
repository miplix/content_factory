// ============================================================
// Telegram Bot Webhook — YupSoul Content Factory
// Русифицированный интерфейс с упрощённым меню
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { getActiveLLMProvider, getActiveImageProvider, getEnabledPlatforms } from '@/lib/config';
import { validateSystem } from '@/lib/validator';
import { generateTikTokCarousel, generateAllSignsCarousel, pickAllSignsTheme } from '@/lib/generators/tiktok-carousel';
import { sendCarouselAsImages } from '@/lib/publishers/telegram';
import { getContentItems, getDeliveryHours, setDeliveryHours, getUsedThemesLog, getRecentThemes } from '@/lib/db';
import { ZODIAC_RU, ZODIAC_EMOJI, ZODIAC_SIGNS, RUBRIC_RU } from '@/lib/types';
import type { ZodiacSign, ContentRubric, AppConfig, TelegramConfig } from '@/lib/types';

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

// Русские подписи для слэш-меню и кнопки «≡» внутри Telegram.
// Вызывается из /start — Telegram принимает полный список, перезатирая старый.
async function ensureBotCommands(token: string) {
  await Promise.all([
    tgApi(token, 'setMyCommands', {
      commands: [
        { command: 'carousel', description: 'Карусель по знаку зодиака' },
        { command: 'compat', description: 'Совместимость двух знаков' },
        { command: 'all', description: 'Все 12 знаков на одну тему' },
        { command: 'rubric', description: 'Карусель по рубрике' },
        { command: 'random', description: 'Случайная карусель' },
        { command: 'meme', description: 'Мем-карусель' },
        { command: 'gift', description: 'Карусель «Подарок»' },
        { command: 'schedule', description: 'Настроить время доставки' },
        { command: 'status', description: 'Статус системы' },
        { command: 'help', description: 'Помощь' },
      ],
    }),
    tgApi(token, 'setChatMenuButton', {
      menu_button: { type: 'commands' },
    }),
  ]);
}

// --- Главное меню (всегда на экране) ---
const MAIN_MENU = {
  keyboard: [
    [{ text: 'Карусель по знаку' }, { text: 'Совместимость' }],
    [{ text: 'Все 12 знаков' }, { text: 'Рубрика' }],
    [{ text: 'Случайная' }, { text: 'Расписание' }],
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
  'signs_in_business',
  'month_ahead',
  'zodiac_life_examples',
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
  'все 12 знаков': '/all',
  'случайная': '/random',
  'рубрика': '/rubric',
  'расписание': '/schedule',
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
  '/all [тема] — все 12 знаков на одну тему',
  '/rubric — карусель по выбранной рубрике',
  '/random — случайная карусель',
  '/meme — мем-карусель',
  '/gift — карусель «Подарок»',
  '/schedule — настроить время автодоставки',
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

// --- Клавиатура настройки расписания ---
const SCHED_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

function scheduleKeyboard(activeHours: number[]) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < SCHED_HOURS.length; i += 4) {
    rows.push(
      SCHED_HOURS.slice(i, i + 4).map(h => ({
        text: activeHours.includes(h) ? `✅ ${h}:00` : `${h}:00`,
        callback_data: `sched:${h}`,
      })),
    );
  }
  return { inline_keyboard: rows };
}

function scheduleText(hours: number[]): string {
  const list = hours.length ? hours.map(h => `${h}:00`).join(', ') : 'не выбрано';
  return [
    '⏰ <b>Расписание доставки</b> (время Тбилиси)',
    '',
    `Активные часы: <b>${list}</b>`,
    '',
    'Нажми на час чтобы включить или выключить.',
    '<i>Для постоянного сохранения обнови DELIVERY_HOURS в настройках Vercel.</i>',
  ].join('\n');
}

// Состояние для двухшаговых сценариев
const pendingCompat: Map<number, { sign1: ZodiacSign }> = new Map();

// Ожидание ввода кастомной темы (chatId → true)
const pendingCustomTheme = new Map<number, boolean>();

// Параметры для кнопки «Повторить»
interface RetryParams {
  type: 'carousel' | 'compat' | 'rubric' | 'all';
  rubric?: ContentRubric;
  zodiacSign?: ZodiacSign;
  zodiacSign2?: ZodiacSign;
  theme?: string;
}
const pendingRetry = new Map<string, RetryParams>();

// --- Генерация + отправка с кнопкой «Повторить» при ошибке ---
async function generateAndSend(
  params: RetryParams,
  chatId: string | number,
  token: string,
  config: AppConfig,
  tgCfg: TelegramConfig,
) {
  try {
    let carousel;
    if (params.type === 'all') {
      carousel = await generateAllSignsCarousel({ theme: params.theme, config });
    } else {
      carousel = await generateTikTokCarousel({
        rubric: params.rubric!,
        zodiacSign: params.zodiacSign,
        zodiacSign2: params.zodiacSign2,
        config,
      });
    }
    await sendCarouselAsImages(carousel, tgCfg);
  } catch (error) {
    const retryId = Math.random().toString(36).slice(2, 10);
    pendingRetry.set(retryId, params);
    setTimeout(() => pendingRetry.delete(retryId), 3_600_000);

    const msg = error instanceof Error ? error.message.slice(0, 200) : String(error);
    await tgApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `⚠️ Не удалось сгенерировать карусель:\n<code>${escapeHtml(msg)}</code>`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Повторить', callback_data: `retry:${retryId}` }]] },
    });
  }
}

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

      const colonIdx = data.indexOf(':');
      const prefix = colonIdx >= 0 ? data.slice(0, colonIdx) : data;
      const value = colonIdx >= 0 ? data.slice(colonIdx + 1) : '';

      // --- Расписание ---
      if (prefix === 'sched') {
        const hour = parseInt(value);
        const hours = getDeliveryHours();
        const idx = hours.indexOf(hour);
        if (idx >= 0) hours.splice(idx, 1); else hours.push(hour);
        setDeliveryHours(hours);

        await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id });
        await tgApi(token, 'editMessageText', {
          chat_id: chatId,
          message_id: cb.message?.message_id,
          text: scheduleText(getDeliveryHours()),
          parse_mode: 'HTML',
          reply_markup: scheduleKeyboard(getDeliveryHours()),
        });
        return NextResponse.json({ ok: true });
      }

      // --- Повтор после ошибки ---
      if (prefix === 'retry') {
        const params = pendingRetry.get(value);
        if (!params) {
          await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Время истекло — начни заново' });
          return NextResponse.json({ ok: true });
        }
        await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Повторяю…' });
        await tgApi(token, 'sendMessage', { chat_id: chatId, text: '🔄 Повторная генерация…' });
        await generateAndSend(params, chatId, token, config, config.platforms.telegram!);
        return NextResponse.json({ ok: true });
      }

      // --- Выбор темы для /all ---
      if (data === 'all_auto') {
        const theme = pickAllSignsTheme(getRecentThemes(7));
        await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: `Тема: ${theme}` });
        await tgApi(token, 'sendMessage', { chat_id: chatId, text: `✨ Тема: «${theme}» — генерирую…` });
        await generateAndSend({ type: 'all', theme }, chatId, token, config, config.platforms.telegram!);
        return NextResponse.json({ ok: true });
      }

      if (data === 'all_custom') {
        pendingCustomTheme.set(chatId, true);
        await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id });
        await tgApi(token, 'sendMessage', { chat_id: chatId, text: '✏️ Напиши тему (например: <i>когда злятся</i> или <i>в отпуске</i>):', parse_mode: 'HTML' });
        return NextResponse.json({ ok: true });
      }

      await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Генерирую…' });

      if (prefix === 'car') {
        const sign = value as ZodiacSign;
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${ZODIAC_EMOJI[sign]} Генерирую карусель для знака «${ZODIAC_RU[sign]}»…`,
        });
        await generateAndSend(
          { type: 'carousel', rubric: 'zodiac_sound', zodiacSign: sign },
          chatId, token, config, config.platforms.telegram!,
        );
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
        await generateAndSend(
          { type: 'compat', rubric: 'compatibility', zodiacSign: sign1, zodiacSign2: sign2 },
          chatId, token, config, config.platforms.telegram!,
        );
        return NextResponse.json({ ok: true });
      }

      if (prefix === 'rub') {
        const rubric = value as ContentRubric;
        const noSignRubrics: ContentRubric[] = ['signs_as_genres', 'daily_energy', 'signs_in_business', 'zodiac_all_twelve'];
        if (noSignRubrics.includes(rubric)) {
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `Генерирую карусель «${RUBRIC_RU[rubric]}»…`,
          });
          await generateAndSend(
            { type: 'carousel', rubric },
            chatId, token, config, config.platforms.telegram!,
          );
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
        await generateAndSend(
          { type: 'rubric', rubric, zodiacSign: sign },
          chatId, token, config, config.platforms.telegram!,
        );
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

    // Ввод кастомной темы для /all
    if (pendingCustomTheme.has(message.chat.id)) {
      pendingCustomTheme.delete(message.chat.id);
      const theme = raw.slice(0, 100);
      await tgApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `✨ Тема «${theme}» — генерирую все 12 знаков…`,
      });
      await generateAndSend({ type: 'all', theme }, chatId, token, config, config.platforms.telegram!);
      return NextResponse.json({ ok: true });
    }

    const command = lower.startsWith('/')
      ? lower.split(/[\s@]/)[0]
      : MENU_ALIASES[lower] || '';

    switch (command) {
      case '/start': {
        await ensureBotCommands(token);
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

      case '/all': {
        const themeArg = raw.replace(/^\/all/i, '').trim();
        if (themeArg) {
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `Генерирую карусель для всех 12 знаков: «${themeArg}»…`,
          });
          await generateAndSend({ type: 'all', theme: themeArg }, chatId, token, config, config.platforms.telegram!);
        } else {
          await tgApi(token, 'sendMessage', {
            chat_id: chatId,
            text: '🌌 Карусель для всех 12 знаков.\nКакую тему использовать?',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎲 Случайная тема', callback_data: 'all_auto' }],
                [{ text: '✏️ Своя тема', callback_data: 'all_custom' }],
              ],
            },
          });
        }
        break;
      }

      case '/schedule': {
        const hours = getDeliveryHours();
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: scheduleText(hours),
          parse_mode: 'HTML',
          reply_markup: scheduleKeyboard(hours),
        });
        break;
      }

      case '/meme': {
        const randomSign = ZODIAC_SIGNS[Math.floor(Math.random() * 12)];
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Генерирую мем-карусель…',
        });
        await generateAndSend(
          { type: 'carousel', rubric: 'zodiac_memes', zodiacSign: randomSign },
          chatId, token, config, config.platforms.telegram!,
        );
        break;
      }

      case '/gift': {
        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: 'Генерирую карусель «Подарок»…',
        });
        await generateAndSend(
          { type: 'carousel', rubric: 'gift' },
          chatId, token, config, config.platforms.telegram!,
        );
        break;
      }

      case '/random': {
        const allRubrics: ContentRubric[] = [
          ...BOT_RUBRICS, 'signs_in_business', 'month_ahead', 'zodiac_life_examples',
        ];
        const rub = allRubrics[Math.floor(Math.random() * allRubrics.length)];
        const sign = ZODIAC_SIGNS[Math.floor(Math.random() * 12)];
        const sign2 = rub === 'compatibility' ? ZODIAC_SIGNS[Math.floor(Math.random() * 12)] : undefined;

        await tgApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `Случайная карусель: «${RUBRIC_RU[rub]}» ${ZODIAC_EMOJI[sign]} ${ZODIAC_RU[sign]}…`,
        });
        await generateAndSend(
          { type: 'carousel', rubric: rub, zodiacSign: sign, zodiacSign2: sign2 },
          chatId, token, config, config.platforms.telegram!,
        );
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
            '',
            `Расписание: <b>${getDeliveryHours().map(h => `${h}:00`).join(', ') || 'не задано'}</b>`,
            '',
            '<b>Последние темы «Все 12 знаков»:</b>',
            ...getUsedThemesLog(5).map(u => {
              const d = new Date(u.usedAt);
              return `• ${u.theme} <i>(${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })})</i>`;
            }),
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
