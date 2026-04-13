// ============================================================
// Content Factory — Text Generator (YupSoul)
// Multi-LLM: Gemini (free) > DeepSeek (free) > Ollama > Anthropic > OpenAI
// 20 rubrics with zodiac-specific prompts
// ============================================================
import type { AppConfig, BrandConfig, Platform, ContentFormat, ContentRubric, ZodiacSign } from '../types';
import { ZODIAC_RU, ZODIAC_EMOJI, RUBRIC_RU } from '../types';
import { getActiveLLMProvider } from '../config';

// --- Platform constraints ---
const PLATFORM_TEXT_LIMITS: Record<Platform, { max: number; optimal: number }> = {
  telegram: { max: 4096, optimal: 1500 },
  youtube: { max: 5000, optimal: 2000 },
  instagram: { max: 2200, optimal: 800 },
  tiktok: { max: 300, optimal: 150 },
  vk: { max: 4096, optimal: 1500 },
  twitter: { max: 280, optimal: 240 },
};

// --- Hashtag sets by platform ---
const HASHTAGS_BY_PLATFORM: Record<Platform, { ru: string[]; en: string[] }> = {
  telegram: {
    ru: ['#астрология', '#гороскоп', '#зодиак', '#yupsoul', '#космическаямелодия'],
    en: ['#astrology', '#horoscope', '#zodiac', '#yupsoul', '#cosmicmelody'],
  },
  instagram: {
    ru: ['#астрология', '#гороскоп', '#знакизодиака', '#yupsoul'],
    en: ['#astrology', '#zodiacsigns', '#horoscope', '#yupsoul'],
  },
  tiktok: {
    ru: ['#астрология', '#гороскоп', '#зодиак', '#рек'],
    en: ['#astrology', '#zodiac', '#fyp'],
  },
  youtube: {
    ru: ['астрология', 'гороскоп', 'знаки зодиака', 'yupsoul', 'космическая мелодия'],
    en: ['astrology', 'horoscope', 'zodiac signs', 'yupsoul', 'cosmic melody'],
  },
  vk: {
    ru: ['#астрология', '#гороскоп', '#зодиак', '#yupsoul'],
    en: ['#astrology', '#horoscope', '#zodiac', '#yupsoul'],
  },
  twitter: {
    ru: ['#астрология', '#гороскоп', '#yupsoul'],
    en: ['#astrology', '#horoscope', '#yupsoul'],
  },
};

// --- LLM Call Abstraction ---
async function callLLM(
  prompt: string,
  systemPrompt: string,
  config: AppConfig
): Promise<string> {
  const provider = getActiveLLMProvider(config);
  if (!provider) {
    throw new Error('No LLM provider configured. Set GEMINI_API_KEY, DEEPSEEK_API_KEY, OLLAMA_BASE_URL, or ANTHROPIC_API_KEY');
  }

  switch (provider) {
    case 'gemini':
      return callGemini(prompt, systemPrompt, config);
    case 'deepseek':
      return callDeepSeek(prompt, systemPrompt, config);
    case 'ollama':
      return callOllama(prompt, systemPrompt, config);
    case 'anthropic':
      return callAnthropic(prompt, systemPrompt, config);
    case 'openai':
      return callOpenAI(prompt, systemPrompt, config);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

// --- Gemini (FREE — 1000 req/day) ---
async function callGemini(prompt: string, systemPrompt: string, config: AppConfig): Promise<string> {
  const model = config.generation.geminiModel || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.generation.geminiApiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// --- DeepSeek (FREE — 500M tokens/month) ---
async function callDeepSeek(prompt: string, systemPrompt: string, config: AppConfig): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.generation.deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// --- Ollama (FREE, local) ---
async function callOllama(prompt: string, systemPrompt: string, config: AppConfig): Promise<string> {
  const baseUrl = config.generation.ollamaBaseUrl || 'http://localhost:11434';
  const model = config.generation.ollamaModel || 'qwen3:7b';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

// --- Anthropic Claude (paid) ---
async function callAnthropic(prompt: string, systemPrompt: string, config: AppConfig): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.generation.anthropicApiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// --- OpenAI (paid) ---
async function callOpenAI(prompt: string, systemPrompt: string, config: AppConfig): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.generation.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// --- System Prompt ---
function buildSystemPrompt(brand: BrandConfig): string {
  const botUrl = brand.botUrl || 'https://t.me/Yup_Soul_bot?start=ref_miplix';

  return `Ты — контент-менеджер бренда "${brand.name}".

О продукте: ${brand.description}
Целевая аудитория: ${brand.targetAudience}
Тон: Мистический + дружеский + современный. Не "старая астрология с картами Таро", а "космическая музыка для души". Разговорный язык с элементами cosmic/spiritual лексики. Юмор допустим (мемы про знаки). Обращение на "ты".
Язык: ${brand.language === 'ru' ? 'русский' : brand.language === 'en' ? 'английский' : 'русский и английский'}

ГЛАВНОЕ ПРЕИМУЩЕСТВО (использовать в КАЖДОМ посте):
- Первая песня — АБСОЛЮТНО БЕСПЛАТНО! Просто зайди и получи свою космическую мелодию.
- Это главный крючок. Подчёркивай бесплатность первого трека в каждом CTA.

Ключевые месседжи:
- "Твои звёзды звучат иначе, чем у всех. Послушай — первый трек бесплатно!"
- "Что если бы момент твоего рождения имел свою мелодию? Узнай бесплатно"
- "Создай свою космическую мелодию прямо сейчас — это бесплатно"
- YupSoul создаёт персональные AI-треки по дате рождения

Ссылка на бота (ВСЕГДА использовать именно эту):
${botUrl}

Правила:
- Каждый пост должен вести к действию: слушай трек, создай свою мелодию, отправь другу
- CTA всегда ведёт на ${botUrl}
- В CTA обязательно упоминай что первая песня бесплатно
- Используй эмодзи умеренно (1-3 на абзац)
- Не используй слово "уникальный" слишком часто
- НЕ генерируй хештеги — они добавляются отдельно`;
}

// --- Generate Text for a Post ---
export async function generateText(params: {
  topic: string;
  platform: Platform;
  format: ContentFormat;
  brand: BrandConfig;
  rubric?: ContentRubric;
  zodiacSign?: ZodiacSign;
  apiKey?: string; // legacy compat
  config?: AppConfig;
}): Promise<{ text: string; caption?: string; hashtags: string[] }> {
  const { topic, platform, format, brand, rubric, zodiacSign } = params;
  const config = params.config;
  if (!config) {
    throw new Error('Config is required for text generation');
  }

  const limits = PLATFORM_TEXT_LIMITS[platform];
  const systemPrompt = buildSystemPrompt(brand);

  const zodiacContext = zodiacSign
    ? `Знак зодиака: ${ZODIAC_RU[zodiacSign]} ${ZODIAC_EMOJI[zodiacSign]}`
    : '';

  const rubricContext = rubric
    ? `Рубрика: "${RUBRIC_RU[rubric]}"`
    : '';

  const platformInstructions: Record<Platform, string> = {
    telegram: `Telegram-пост. Длина: ${limits.optimal} символов макс. Форматирование: HTML (<b>, <i>, <a>). Добавь inline-кнопку текстом: [Создай свою мелодию -> @YupSoul_bot]. Используй опросы/вопросы для engagement.`,
    instagram: `Instagram ${format === 'carousel' ? 'карусель (6-10 слайдов, каждый слайд — отдельный абзац)' : format === 'reels' ? 'Reels описание (короткое, цепляющее)' : 'пост'}. Длина: до ${limits.optimal} символов. Ссылка в био.`,
    tiktok: `TikTok описание. Максимум ${limits.max} символов. Короткое, цепляющее, с тригером на комментарий.`,
    youtube: `YouTube ${format === 'shorts' ? 'Shorts' : 'видео'} — напиши заголовок (до 70 символов) и описание (до ${limits.optimal} символов). Включи ключевые слова для SEO: гороскоп, астрология, знаки зодиака.`,
    vk: `VK-пост. Длина: до ${limits.optimal} символов. Добавь призыв к обсуждению.`,
    twitter: `Твит. Максимум ${limits.max} символов. Одна мысль, одна эмоция, один CTA.`,
  };

  const prompt = `${rubricContext}
${zodiacContext}
Тема: ${topic}
Платформа: ${platformInstructions[platform]}

Напиши готовый пост. Ответ — только текст поста, без пояснений.`;

  const rawText = await callLLM(prompt, systemPrompt, config);

  // Trim to platform limits
  const text = rawText.slice(0, limits.max);
  const caption = platform === 'youtube' ? text.split('\n')[0] : undefined;

  // Generate hashtags
  const langKey = brand.language === 'en' ? 'en' : 'ru';
  const baseHashtags = HASHTAGS_BY_PLATFORM[platform][langKey];
  const signHashtag = zodiacSign ? `#${ZODIAC_RU[zodiacSign].toLowerCase()}` : null;
  const hashtags = signHashtag ? [signHashtag, ...baseHashtags] : baseHashtags;

  return { text, caption, hashtags };
}

// --- Generate Content Plan ---
export async function generateContentPlan(params: {
  brand: BrandConfig;
  platforms: Platform[];
  postsPerDay: Partial<Record<Platform, number>>;
  daysAhead: number;
  apiKey?: string; // legacy compat
  config?: AppConfig;
}): Promise<Array<{ topic: string; platform: Platform; format: string; scheduledDate: string; rubric?: ContentRubric; zodiacSign?: ZodiacSign }>> {
  const { brand, platforms, postsPerDay, daysAhead, config } = params;
  if (!config) {
    throw new Error('Config is required for plan generation');
  }

  const systemPrompt = buildSystemPrompt(brand);

  const rubricsList = Object.entries(RUBRIC_RU)
    .map(([key, name]) => `- ${key}: ${name}`)
    .join('\n');

  const prompt = `Создай контент-план на ${daysAhead} дней для YupSoul.
Платформы: ${platforms.join(', ')}
Постов в день: ${platforms.map(p => `${p}: ${postsPerDay[p] || 1}`).join(', ')}

Доступные рубрики:
${rubricsList}

Для каждого поста верни строго в формате JSON (массив объектов):
[
  {
    "topic": "тема поста",
    "platform": "telegram",
    "format": "text",
    "dayOffset": 0,
    "rubric": "daily_energy",
    "zodiacSign": "aries"
  }
]

zodiacSign указывай только когда пост про конкретный знак.
format: text, image, video, carousel, reels, shorts, story.
dayOffset: 0 = сегодня, 1 = завтра, и т.д.
Верни только JSON, без markdown и пояснений.`;

  const rawResponse = await callLLM(prompt, systemPrompt, config);

  // Parse JSON from response
  const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return generateFallbackPlan(platforms, postsPerDay, daysAhead);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const today = new Date();

    return parsed.map((item: { topic: string; platform: Platform; format: string; dayOffset: number; rubric?: ContentRubric; zodiacSign?: ZodiacSign }) => {
      const date = new Date(today);
      date.setDate(today.getDate() + (item.dayOffset || 0));
      return {
        topic: item.topic,
        platform: item.platform,
        format: item.format || 'text',
        scheduledDate: date.toISOString().split('T')[0],
        rubric: item.rubric,
        zodiacSign: item.zodiacSign,
      };
    });
  } catch {
    return generateFallbackPlan(platforms, postsPerDay, daysAhead);
  }
}

// --- Fallback plan when LLM fails to return valid JSON ---
function generateFallbackPlan(
  platforms: Platform[],
  postsPerDay: Partial<Record<Platform, number>>,
  daysAhead: number
): Array<{ topic: string; platform: Platform; format: string; scheduledDate: string; rubric: ContentRubric; zodiacSign?: ZodiacSign }> {
  const today = new Date();
  const items: Array<{ topic: string; platform: Platform; format: string; scheduledDate: string; rubric: ContentRubric; zodiacSign?: ZodiacSign }> = [];

  const dailyRubrics: ContentRubric[] = ['daily_energy', 'astro_facts', 'zodiac_memes', 'compatibility', 'zodiac_sound'];
  const signs: ZodiacSign[] = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

  for (let day = 0; day < daysAhead; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];

    for (const platform of platforms) {
      const count = postsPerDay[platform] || 1;
      for (let i = 0; i < count; i++) {
        const rubric = dailyRubrics[(day * count + i) % dailyRubrics.length];
        const sign = signs[(day + i) % 12];
        const topic = `${RUBRIC_RU[rubric]} — ${ZODIAC_RU[sign]} ${ZODIAC_EMOJI[sign]}`;

        items.push({
          topic,
          platform,
          format: platform === 'tiktok' || platform === 'youtube' ? 'video' : 'text',
          scheduledDate: dateStr,
          rubric,
          zodiacSign: sign,
        });
      }
    }
  }

  return items;
}
