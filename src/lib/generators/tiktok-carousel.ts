// ============================================================
// Content Factory — TikTok Carousel Generator (YupSoul)
// Generates 5-10 slides for TikTok photo carousel posts
// Astrology + AI music themed content
// ============================================================
import type { AppConfig, BrandConfig, ContentRubric, ZodiacSign } from '../types';
import { ZODIAC_RU, ZODIAC_EMOJI, ZODIAC_SIGNS, RUBRIC_RU } from '../types';
import { getActiveLLMProvider } from '../config';

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
};

// --- Прямой вызов LLM для карусели (без лимита TikTok caption) ---
async function callCarouselLLM(prompt: string, systemPrompt: string, config: AppConfig): Promise<string> {
  const provider = getActiveLLMProvider(config);

  if (provider === 'gemini' && config.generation.geminiApiKey) {
    const model = config.generation.geminiModel || 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.generation.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
      }),
    });

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
- БЕЗ эмодзи и спецсимволов в полях "text" и "description" — только буквы, цифры и обычная пунктуация. Эмодзи можно использовать ТОЛЬКО в поле "caption".`;

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
    const rawResponse = await callCarouselLLM(prompt, systemPrompt, config);

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
    return generateFallbackCarousel(rubric, zodiacSign, config);
  }

  // Гарантируем минимум слайдов
  if (slides.length < 4) {
    return generateFallbackCarousel(rubric, zodiacSign, config);
  }

  // Последний слайд — всегда CTA
  const lastIdx = slides.length - 1;
  if (!slides[lastIdx].text.toLowerCase().includes('бесплатно')) {
    slides[lastIdx] = {
      ...slides[lastIdx],
      text: `Первая песня бесплатно!\nСсылка в шапке профиля`,
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
function generateFallbackCarousel(rubric: ContentRubric, sign?: ZodiacSign, config?: AppConfig): TikTokCarousel {
  const signName = sign ? ZODIAC_RU[sign] : '';
  const signEmoji = sign ? ZODIAC_EMOJI[sign] : '';
  const botUrl = config?.brand.botUrl || 'https://t.me/Yup_Soul_bot?start=ref_miplix';

  const slides: CarouselSlide[] = [
    {
      text: `${signName || 'Твой знак'} — какая у тебя мелодия?`,
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
      text: `Первая песня — бесплатно!`,
      description: botUrl,
      imagePrompt: buildSlideImagePrompt(rubric, sign, 4),
      slideNumber: 5,
    },
  ];

  return {
    title: slides[0].text,
    slides,
    caption: `${RUBRIC_RU[rubric]} ${signEmoji} Первая песня бесплатно!`.trim(),
    hashtags: ['#астрология', '#гороскоп', '#зодиак', '#рек', '#yupsoul'],
    coverSlideIndex: 0,
    rubric,
    zodiacSign: sign,
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
