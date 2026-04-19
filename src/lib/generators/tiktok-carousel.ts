// ============================================================
// Content Factory — TikTok Carousel Generator (YupSoul)
// Generates 5-10 slides for TikTok photo carousel posts
// Astrology + AI music themed content
// ============================================================
import type { AppConfig, BrandConfig, ContentRubric, ZodiacSign } from '../types';
import { ZODIAC_RU, ZODIAC_EMOJI, ZODIAC_SIGNS, RUBRIC_RU } from '../types';
import { getActiveLLMProvider } from '../config';
import { recordUsedTheme, getRecentThemes } from '../db';

export interface CarouselSlide {
  text: string;           // Текст на слайде (крупный, 1-3 строки)
  description: string;    // Подробный текст (мелкий, под картинкой)
  imagePrompt: string;    // Промпт для генерации фона
  slideNumber: number;
}

export interface TikTokCarousel {
  title: string;          // Заголовок карусели (первый слайд — хук)
  slides: CarouselSlide[];
  caption: string;        // Описание поста (до 300 символов)
  hashtags: string[];
  coverSlideIndex: number; // Какой слайд использовать как обложку
  rubric?: ContentRubric;
  zodiacSign?: ZodiacSign;
  zodiacSign2?: ZodiacSign; // Для карусели совместимости
}

// --- Хук-формулы для первого слайда (вызывают свайп) ---
const HOOK_TEMPLATES = [
  'Так звучит {sign} {emoji}',
  '{sign} — твоя космическая мелодия',
  'Почему {sign} слышит музыку иначе',
  '{sign} + {sign2} = какая мелодия?',
  'Что звёзды говорят о {sign} сегодня',
  '{emoji} {sign}: 5 фактов о твоём звуке',
  'Угадай знак по мелодии',
  'Первая песня — бесплатно {emoji}',
  'AI написал песню для {sign}',
  'Твоя дата рождения = твоя мелодия',
];

// --- Шаблоны каруселей по рубрикам ---
const RUBRIC_SLIDE_TEMPLATES: Partial<Record<ContentRubric, {
  slideCount: number;
  structure: string;
}>> = {
  zodiac_sound: {
    slideCount: 7,
    structure: `Слайд 1: Хук — "Так звучит [знак]" (провокация, вопрос)
Слайд 2: Характер звука этого знака (какой жанр, какие инструменты)
Слайд 3: Почему именно такой звук (астрологическое объяснение)
Слайд 4: Интересный факт о музыкальных предпочтениях знака
Слайд 5: Пример — фрагмент описания трека
Слайд 6: "А ты согласен? Напиши свой знак в комментариях"
Слайд 7: CTA — "Первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  compatibility: {
    slideCount: 8,
    structure: `Слайд 1: Хук — "[Знак1] + [Знак2] = ?" (интрига)
Слайд 2: Характер первого знака в музыке
Слайд 3: Характер второго знака в музыке
Слайд 4: Что происходит когда они вместе
Слайд 5: Гармония или диссонанс?
Слайд 6: Совет от звёзд для этой пары
Слайд 7: "Отметь свою половинку!"
Слайд 8: CTA — "Узнай вашу совместимость — первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  daily_energy: {
    slideCount: 5,
    structure: `Слайд 1: "Энергия дня — [дата]" (привлечь внимание)
Слайд 2: Астрологическая обстановка (Луна в знаке, аспекты)
Слайд 3: Какая музыка подходит сегодня
Слайд 4: Совет дня
Слайд 5: CTA — "Послушай свою энергию — первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  zodiac_memes: {
    slideCount: 6,
    structure: `Слайд 1: Хук — "Как [ситуация] для каждого знака" (смешной)
Слайд 2-5: По 3 знака на слайд с короткими смешными описаниями
Слайд 6: CTA — "А какой ты? Первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  astro_facts: {
    slideCount: 6,
    structure: `Слайд 1: Хук — интересный факт (вопрос, который заставляет свайпнуть)
Слайд 2: Объяснение факта
Слайд 3: Как это связано с музыкой
Слайд 4: Применение в YupSoul
Слайд 5: "Сохрани, чтобы не забыть"
Слайд 6: CTA — "Узнай свой звук — первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  signs_as_genres: {
    slideCount: 7,
    structure: `Слайд 1: Хук — "Какой жанр музыки = твой знак?" (вопрос)
Слайд 2: Огненные знаки (Овен, Лев, Стрелец) + их жанры
Слайд 3: Земные знаки (Телец, Дева, Козерог) + их жанры
Слайд 4: Воздушные знаки (Близнецы, Весы, Водолей) + их жанры
Слайд 5: Водные знаки (Рак, Скорпион, Рыбы) + их жанры
Слайд 6: "Согласен? Напиши свой знак и жанр в комментариях!"
Слайд 7: CTA — "Узнай свой настоящий жанр — первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  gift: {
    slideCount: 5,
    structure: `Слайд 1: Хук — "Подарок, который невозможно повторить" (интрига)
Слайд 2: Проблема — все подарки одинаковые
Слайд 3: Решение — персональная космическая мелодия по дате рождения
Слайд 4: Как это работает (3 шага: введи дату → AI создаёт → слушай)
Слайд 5: CTA — "Создай подарок — первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  signs_in_business: {
    slideCount: 7,
    structure: `Слайд 1: Хук — "Какой ты в бизнесе — по знаку зодиака?" (провокация)
Слайд 2: Сильная сторона знака в работе и переговорах
Слайд 3: Слабость и как её использовать
Слайд 4: С кем этот знак лучше всего в команде
Слайд 5: Как этот знак зарабатывает и тратит деньги
Слайд 6: Идеальная бизнес-роль для этого знака
Слайд 7: CTA — "Твоя деловая мелодия — первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  month_ahead: {
    slideCount: 6,
    structure: `Слайд 1: Хук — "Что ждёт [знак] в этом месяце?" (вызывает интерес)
Слайд 2: Общая астрологическая обстановка месяца для знака
Слайд 3: Любовь и отношения
Слайд 4: Карьера и деньги
Слайд 5: Энергия и здоровье. Совет месяца.
Слайд 6: CTA — "Послушай мелодию своего месяца — первая песня бесплатно! Ссылка в шапке профиля"`,
  },
  zodiac_life_examples: {
    slideCount: 7,
    structure: `Слайд 1: Хук — конкретная смешная/узнаваемая ситуация из жизни знака
Слайд 2: Как [знак] реагирует на стресс — конкретный пример
Слайд 3: [Знак] в отношениях — реальный сценарий
Слайд 4: [Знак] на работе — узнаваемая ситуация
Слайд 5: Цитата, которую [знак] говорит чаще всего
Слайд 6: "Ты [знак]? Напиши в комментариях узнал ли себя!"
Слайд 7: CTA — "Первая песня бесплатно! Ссылка в шапке профиля"`,
  },
};

// --- Прямой вызов LLM для карусели (без лимита TikTok caption) ---
async function callCarouselLLM(prompt: string, systemPrompt: string, config: AppConfig): Promise<string> {
  const provider = getActiveLLMProvider(config);

  if (provider === 'gemini' && config.generation.geminiApiKey) {
    const model = config.generation.geminiModel || 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.generation.geminiApiKey}`;

    const abortCtrl = new AbortController();
    const abortTimer = setTimeout(() => abortCtrl.abort(), 25_000);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
      }),
      signal: abortCtrl.signal,
    }).finally(() => clearTimeout(abortTimer));

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Фоллбек на другие провайдеры через text.ts
  const { generateText } = await import('./text');
  const result = await generateText({
    topic: prompt,
    platform: 'telegram', // используем telegram чтобы не обрезало до 300 символов
    format: 'text',
    brand: config.brand,
    config,
  });
  return result.text;
}

// --- Генерация карусели через LLM ---
export async function generateTikTokCarousel(params: {
  rubric: ContentRubric;
  zodiacSign?: ZodiacSign;
  zodiacSign2?: ZodiacSign; // Для совместимости
  config: AppConfig;
}): Promise<TikTokCarousel> {
  const { rubric, zodiacSign, zodiacSign2, config } = params;

  const template = RUBRIC_SLIDE_TEMPLATES[rubric];
  const slideCount = template?.slideCount || 6;
  const structure = template?.structure || '';

  const signContext = zodiacSign
    ? `Знак: ${ZODIAC_RU[zodiacSign]} ${ZODIAC_EMOJI[zodiacSign]}`
    : '';
  const sign2Context = zodiacSign2
    ? `Второй знак: ${ZODIAC_RU[zodiacSign2]} ${ZODIAC_EMOJI[zodiacSign2]}`
    : '';

  const botUrl = config.brand.botUrl || 'https://t.me/Yup_Soul_bot?start=ref_miplix';

  const systemPrompt = `Ты создаёшь TikTok фото-карусели для бренда YupSoul.
YupSoul — Telegram Mini App, создаёт персональные AI-музыкальные композиции по дате рождения.
ГЛАВНОЕ: первая песня абсолютно бесплатно!
Ссылка на бот: ${botUrl}

Стиль: мистический + дружеский + современный. Обращение на "ты".
Целевая аудитория: женщины 18-35, астрология, самопознание.

Правила для TikTok карусели:
- Первый слайд = ХУКК (заставляет свайпнуть)
- Текст на каждом слайде: КРУПНЫЙ, 1-3 строки, читается за 2-3 секунды
- Последний слайд = CTA с упоминанием что первая песня бесплатно
- Всего ${slideCount} слайдов
- Каждый слайд вызывает желание свайпнуть дальше
- Максимум 1-2 эмодзи на слайд (шрифт монохромный — избегай сложных цветных композиций типа флагов стран и ZWJ-последовательностей)`;

  const prompt = `Рубрика: "${RUBRIC_RU[rubric]}"
${signContext}
${sign2Context}

${structure ? `Структура:\n${structure}` : ''}

Создай TikTok-карусель. Верни строго JSON:
{
  "title": "заголовок (первый слайд)",
  "slides": [
    {"text": "крупный текст слайда", "description": "мелкий подтекст"}
  ],
  "caption": "описание поста до 150 символов"
}

ТОЛЬКО JSON, без markdown.`;

  const provider = getActiveLLMProvider(config);

  if (!provider) {
    return generateFallbackCarousel(rubric, zodiacSign, config);
  }

  // Вызываем LLM напрямую через Gemini/другой провайдер
  let slides: CarouselSlide[];
  let caption: string;

  try {
    const rawResponse = await callCarouselLLM(prompt, systemPrompt, config).catch(() => {
      throw new Error('LLM timeout or error');
    });

    // Пробуем распарсить JSON
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      slides = (parsed.slides || []).map((s: { text: string; description?: string }, i: number) => ({
        text: s.text || '',
        description: s.description || '',
        imagePrompt: buildSlideImagePrompt(rubric, zodiacSign, i),
        slideNumber: i + 1,
      }));
      caption = parsed.caption || '';
    } else {
      // Если не JSON — разбиваем текст на слайды
      const parts = rawResponse.split(/\n\n+/).filter(Boolean);
      slides = parts.slice(0, slideCount).map((text, i) => ({
        text: text.replace(/^(Слайд \d+[:.]\s*)/i, '').slice(0, 120),
        description: '',
        imagePrompt: buildSlideImagePrompt(rubric, zodiacSign, i),
        slideNumber: i + 1,
      }));
      caption = '';
    }
  } catch {
    return generateFallbackCarousel(rubric, zodiacSign, config, zodiacSign2);
  }

  // Гарантируем минимум слайдов
  if (slides.length < 4) {
    return generateFallbackCarousel(rubric, zodiacSign, config, zodiacSign2);
  }

  // Последний слайд — всегда CTA
  const lastIdx = slides.length - 1;
  if (!slides[lastIdx].text.toLowerCase().includes('бесплатно')) {
    slides[lastIdx] = {
      ...slides[lastIdx],
      text: `Первая песня бесплатно! ${ZODIAC_EMOJI[zodiacSign || 'aries']}\nСсылка в шапке профиля`,
      description: 'YupSoul — космическая мелодия твоей души',
    };
  }

  if (!caption) {
    caption = `${RUBRIC_RU[rubric]}${zodiacSign ? ` ${ZODIAC_EMOJI[zodiacSign]}` : ''}`;
  }

  return {
    title: slides[0]?.text || RUBRIC_RU[rubric],
    slides,
    caption: caption.slice(0, 150),
    hashtags: ['#астрология', '#гороскоп', '#зодиак', '#рек', '#yupsoul'],
    coverSlideIndex: 0,
    rubric,
    zodiacSign,
    zodiacSign2,
  };
}

// --- Хук для первого слайда ---
function generateHook(rubric: ContentRubric, sign?: ZodiacSign, sign2?: ZodiacSign): string {
  const template = HOOK_TEMPLATES[Math.floor(Math.random() * HOOK_TEMPLATES.length)];
  const signName = sign ? ZODIAC_RU[sign] : 'твоего знака';
  const signEmoji = sign ? ZODIAC_EMOJI[sign] : '\u2728';
  const sign2Name = sign2 ? ZODIAC_RU[sign2] : ZODIAC_RU[ZODIAC_SIGNS[Math.floor(Math.random() * 12)]];

  return template
    .replace('{sign}', signName)
    .replace('{sign2}', sign2Name)
    .replace('{emoji}', signEmoji);
}

// --- Промпт для изображения слайда ---
function buildSlideImagePrompt(rubric: ContentRubric, sign?: ZodiacSign, slideIndex?: number): string {
  const zodiacPart = sign
    ? `${sign} zodiac constellation, ${ZODIAC_RU[sign]} symbol, `
    : '';

  const baseParts = [
    `${zodiacPart}cosmic background`,
    'deep purple (#2D1B69) and dark blue (#1A1A3E) gradient',
    'stars and nebula, soft golden glow (#D4A574)',
    'minimalist, clean, modern spiritual aesthetic',
    'vertical format 9:16, TikTok slide',
    'large readable text area in center',
  ];

  // Варьируем визуал по номеру слайда
  if (slideIndex === 0) {
    baseParts.push('dramatic, eye-catching, bold');
  } else if (slideIndex !== undefined && slideIndex >= 4) {
    baseParts.push('call to action, warm inviting glow, music waves');
  }

  return baseParts.join(', ');
}

// --- Фоллбек карусель без LLM ---
function generateFallbackCarousel(rubric: ContentRubric, sign?: ZodiacSign, config?: AppConfig, sign2?: ZodiacSign): TikTokCarousel {
  const signName = sign ? ZODIAC_RU[sign] : '';
  const signEmoji = sign ? ZODIAC_EMOJI[sign] : '\u2728';
  const botUrl = config?.brand.botUrl || 'https://t.me/Yup_Soul_bot?start=ref_miplix';

  const slides: CarouselSlide[] = [
    {
      text: `${signEmoji} ${signName || 'Твой знак'} — какая у тебя мелодия?`,
      description: 'Свайпни, чтобы узнать',
      imagePrompt: buildSlideImagePrompt(rubric, sign, 0),
      slideNumber: 1,
    },
    {
      text: `AI создаёт музыку по дате рождения`,
      description: 'Каждый момент рождения имеет свой звук',
      imagePrompt: buildSlideImagePrompt(rubric, sign, 1),
      slideNumber: 2,
    },
    {
      text: `${signName ? signName + ' звучит как' : 'Звук твоего знака'}: ${getGenreForSign(sign)}`,
      description: 'Но твой трек — полностью уникальный',
      imagePrompt: buildSlideImagePrompt(rubric, sign, 2),
      slideNumber: 3,
    },
    {
      text: `Просто введи дату рождения — и услышь свою мелодию`,
      description: '30 секунд — и трек готов',
      imagePrompt: buildSlideImagePrompt(rubric, sign, 3),
      slideNumber: 4,
    },
    {
      text: `Первая песня — бесплатно! ${signEmoji}`,
      description: botUrl,
      imagePrompt: buildSlideImagePrompt(rubric, sign, 4),
      slideNumber: 5,
    },
  ];

  return {
    title: slides[0].text,
    slides,
    caption: `${RUBRIC_RU[rubric]} ${signEmoji} Первая песня бесплатно!`,
    hashtags: ['#астрология', '#гороскоп', '#зодиак', '#рек', '#yupsoul'],
    coverSlideIndex: 0,
    rubric,
    zodiacSign: sign,
    zodiacSign2: sign2,
  };
}

// --- Жанр по знаку (для фоллбека) ---
function getGenreForSign(sign?: ZodiacSign): string {
  const genres: Record<ZodiacSign, string> = {
    aries: 'drum & bass, энергичный рок',
    taurus: 'lo-fi, soul, R&B',
    gemini: 'pop, электроника',
    cancer: 'инди, фолк, акустика',
    leo: 'хип-хоп, поп, глэм-рок',
    virgo: 'классика, минимализм',
    libra: 'джаз, bossa nova',
    scorpio: 'дарк-поп, готика, триллвейв',
    sagittarius: 'регги, world music',
    capricorn: 'рок, блюз, классика',
    aquarius: 'электроника, синтвейв',
    pisces: 'эмбиент, дрим-поп',
  };
  return sign ? genres[sign] : 'что-то космическое';
}

// --- Пул тем для карусели «Все 12 знаков» ---
export const ALLSIGNS_THEMES = [
  // Повседневные ситуации
  'когда злятся', 'когда влюблены', 'когда одни дома', 'в очереди',
  'утром в понедельник', 'в пятницу вечером', 'после полуночи', 'в воскресенье вечером',
  'когда устали', 'когда скучают', 'когда не могут уснуть', 'когда теряют вещи',

  // Работа и учёба
  'в рабочем чате', 'в деловых переговорах', 'на утренней планёрке',
  'при виде дедлайна', 'когда получают похвалу', 'во время экзамена',
  'когда что-то идёт не так', 'на корпоративе',

  // Отношения и люди
  'на первом свидании', 'при виде бывшего', 'когда их игнорируют',
  'когда не перезвонили', 'когда говорят им «успокойся»',
  'когда получают непрошеный совет', 'когда говорят «нам надо поговорить»',
  'когда видят идеального человека',

  // Бытовые моменты
  'при выборе фильма', 'в пробке', 'за рулём', 'при уборке дома',
  'когда что-то сломалось', 'при выборе ресторана', 'за покупками',
  'когда кончился интернет', 'когда перегрузился телефон',
  'при открытии холодильника в 2 ночи',

  // Досуг и события
  'в тренажёрном зале', 'в отпуске', 'в самолёте', 'на свидании вслепую',
  'на свадьбе малознакомых людей', 'на новогодней вечеринке',
  'когда не хотят на вечеринку', 'когда просят помочь переехать',
  'при просмотре ужасов', 'когда слышат музыку из детства',

  // Деньги и планы
  'при виде счёта в ресторане', 'когда видят цену на недвижимость',
  'когда планируют отпуск', 'когда опаздывают', 'когда выбирают подарок',

  // Астрология
  'во время ретрограда Меркурия', 'при просмотре чужих историй',
  'когда им говорят «ты типичный [знак]»',

  // Животные, природа
  'когда видят собаку на улице', 'когда идёт дождь',

  // Коммуникация
  'когда не отвечают на сообщение', 'во время ожидания доставки',
  'когда заболели', 'при встрече с соседями',
];

export function pickAllSignsTheme(usedRecently: string[] = []): string {
  const available = ALLSIGNS_THEMES.filter(t => !usedRecently.includes(t));
  const pool = available.length >= 5 ? available : ALLSIGNS_THEMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Карусель «Все 12 знаков на одну тему» ---
// Структура: хук + 6 слайдов (по 2 знака) + CTA = 8 слайдов
export async function generateAllSignsCarousel(params: {
  theme?: string; // если не задана — берём из пула
  config: AppConfig;
}): Promise<TikTokCarousel> {
  const { config } = params;
  const theme = params.theme || pickAllSignsTheme(getRecentThemes(7));
  recordUsedTheme(theme);
  const botUrl = config.brand.botUrl || 'https://t.me/Yup_Soul_bot?start=ref_miplix';

  const systemPrompt = `Ты создаёшь TikTok-карусель про знаки зодиака для бренда YupSoul (AI-музыка по дате рождения).
Стиль: смешной, меткий, узнаваемый. Аудитория: женщины 18-35.
Каждая фраза — конкретный образ или поступок, НЕ абстрактное описание.
Хорошо: "Смотрит всем в лицо и ждёт извинений первым"
Плохо: "Очень эмоциональный и не любит конфликты"`;

  const prompt = `Тема: "Знаки зодиака: ${theme}"

Напиши для каждого знака зодиака ОДНУ короткую меткую фразу (7-14 слов) про то, как они ведут себя в этой ситуации.
Возвращай ТОЛЬКО JSON без markdown:
{
  "aries": "...",
  "taurus": "...",
  "gemini": "...",
  "cancer": "...",
  "leo": "...",
  "virgo": "...",
  "libra": "...",
  "scorpio": "...",
  "sagittarius": "...",
  "capricorn": "...",
  "aquarius": "...",
  "pisces": "..."
}`;

  let descriptions: Record<ZodiacSign, string> | null = null;

  const provider = getActiveLLMProvider(config);
  if (provider) {
    try {
      const raw = await callCarouselLLM(prompt, systemPrompt, config);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (ZODIAC_SIGNS.every(s => typeof parsed[s] === 'string')) {
          descriptions = parsed as Record<ZodiacSign, string>;
        }
      }
    } catch { /* fallback below */ }
  }

  // Фоллбек — короткие шутливые описания
  if (!descriptions) {
    const fallbacks: Record<ZodiacSign, string> = {
      aries: 'Действует первым, думает потом',
      taurus: 'Игнорирует всех и ест',
      gemini: 'Уже придумал три версии событий',
      cancer: 'Обиделся, но виду не показывает',
      leo: 'Уже фотографируется для истории',
      virgo: 'Составляет план действий',
      libra: 'Взвешивает за и против уже 40 минут',
      scorpio: 'Молчит и всё запоминает',
      sagittarius: 'Превратил это в приключение',
      capricorn: 'Это уже в списке задач',
      aquarius: 'Философствует вместо того чтобы действовать',
      pisces: 'Уплыл в свои мысли',
    };
    descriptions = fallbacks;
  }

  // Пары знаков для слайдов
  const PAIRS: [ZodiacSign, ZodiacSign][] = [
    ['aries', 'taurus'],
    ['gemini', 'cancer'],
    ['leo', 'virgo'],
    ['libra', 'scorpio'],
    ['sagittarius', 'capricorn'],
    ['aquarius', 'pisces'],
  ];

  const hookText = `Знаки зодиака ${theme} ✨`;

  const contentSlides: CarouselSlide[] = PAIRS.map(([a, b], idx) => ({
    text: `${ZODIAC_EMOJI[a]} ${ZODIAC_RU[a]}\n${descriptions![a]}\n\n${ZODIAC_EMOJI[b]} ${ZODIAC_RU[b]}\n${descriptions![b]}`,
    description: '',
    imagePrompt: buildSlideImagePrompt('zodiac_all_twelve'),
    slideNumber: idx + 2,
  }));

  const slides: CarouselSlide[] = [
    {
      text: hookText,
      description: 'Свайпни — найди свой знак 👇',
      imagePrompt: buildSlideImagePrompt('zodiac_all_twelve', undefined, 0),
      slideNumber: 1,
    },
    ...contentSlides,
    {
      text: `Первая песня — бесплатно! ✨\nСсылка в шапке профиля`,
      description: botUrl,
      imagePrompt: buildSlideImagePrompt('zodiac_all_twelve', undefined, 7),
      slideNumber: 8,
    },
  ];

  return {
    title: hookText,
    slides,
    caption: `Все знаки зодиака ${theme} — найди себя! 🌟`,
    hashtags: ['#астрология', '#знакизодиака', '#гороскоп', '#рек', '#yupsoul'],
    coverSlideIndex: 0,
    rubric: 'zodiac_all_twelve',
  };
}

// --- Массовая генерация карусели на неделю ---
export async function generateWeeklyCarousels(config: AppConfig): Promise<TikTokCarousel[]> {
  const carousels: TikTokCarousel[] = [];
  const rubrics: ContentRubric[] = [
    'zodiac_sound', 'compatibility', 'astro_facts',
    'zodiac_memes', 'signs_as_genres', 'daily_energy', 'gift',
  ];

  for (let day = 0; day < 7; day++) {
    // 2 карусели в день
    for (let post = 0; post < 2; post++) {
      const rubric = rubrics[(day * 2 + post) % rubrics.length];
      const sign = ZODIAC_SIGNS[(day * 2 + post) % 12];
      const sign2 = rubric === 'compatibility'
        ? ZODIAC_SIGNS[(day * 2 + post + 6) % 12]
        : undefined;

      try {
        const carousel = await generateTikTokCarousel({
          rubric,
          zodiacSign: sign,
          zodiacSign2: sign2,
          config,
        });
        carousels.push(carousel);
      } catch (e) {
        console.error(`Failed to generate carousel day ${day} post ${post}:`, e);
        // Фоллбек
        carousels.push(generateFallbackCarousel(rubric, sign, config));
      }
    }
  }

  return carousels;
}
