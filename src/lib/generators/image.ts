// ============================================================
// Content Factory — Image Generator (YupSoul)
// Cosmic style: deep purple, gold accents, zodiac imagery
// Supports: Stability AI > OpenAI DALL-E > Replicate > Placeholder
// ============================================================
import type { AppConfig, BrandConfig, Platform, ZodiacSign, ContentRubric } from '../types';
import { ZODIAC_RU, ZODIAC_EMOJI } from '../types';
import { getActiveImageProvider } from '../config';

// --- Image sizes per platform ---
const IMAGE_SIZES: Record<Platform, { width: number; height: number; label: string }> = {
  telegram: { width: 1080, height: 1080, label: '1:1' },
  instagram: { width: 1080, height: 1350, label: '4:5 portrait' },
  tiktok: { width: 1080, height: 1920, label: '9:16' },
  youtube: { width: 1280, height: 720, label: '16:9 thumbnail' },
  vk: { width: 1080, height: 1080, label: '1:1' },
  twitter: { width: 1200, height: 675, label: '16:9' },
};

// --- YupSoul cosmic style prompt ---
function buildImagePrompt(params: {
  topic: string;
  platform: Platform;
  brand: BrandConfig;
  zodiacSign?: ZodiacSign;
  rubric?: ContentRubric;
}): string {
  const { topic, zodiacSign } = params;

  const zodiacPart = zodiacSign
    ? `${ZODIAC_RU[zodiacSign]} constellation, ${zodiacSign} zodiac symbol, `
    : '';

  return `${zodiacPart}cosmic background, deep purple (#2D1B69) and dark blue (#1A1A3E) gradient, stars and nebula, soft glowing golden particles (#D4A574), minimalist design, clean layout, ethereal atmosphere, high contrast, digital art, music sound waves, celestial harmony. Topic: ${topic}. Modern spiritual aesthetic, not occult.`;
}

// --- Generate Image ---
export async function generateImage(params: {
  topic: string;
  platform: Platform;
  brand: BrandConfig;
  zodiacSign?: ZodiacSign;
  rubric?: ContentRubric;
  openaiApiKey?: string;   // legacy
  replicateApiKey?: string; // legacy
  config?: AppConfig;
}): Promise<{ imageUrl: string; prompt: string }> {
  const { topic, platform, brand, zodiacSign, rubric, config } = params;
  const prompt = buildImagePrompt({ topic, platform, brand, zodiacSign, rubric });

  if (config) {
    const provider = getActiveImageProvider(config);

    if (provider === 'stability' && config.generation.stabilityApiKey) {
      return generateWithStability(prompt, platform, config.generation.stabilityApiKey);
    }
    if (provider === 'openai' && config.generation.openaiApiKey) {
      return generateWithOpenAI(prompt, config.generation.openaiApiKey);
    }
    if (provider === 'replicate' && config.generation.replicateApiKey) {
      return generateWithReplicate(prompt, config.generation.replicateApiKey);
    }
  }

  // Legacy fallback
  if (params.openaiApiKey) {
    return generateWithOpenAI(prompt, params.openaiApiKey);
  }
  if (params.replicateApiKey) {
    return generateWithReplicate(prompt, params.replicateApiKey);
  }

  // Free placeholder
  return generatePlaceholder(prompt, platform, zodiacSign);
}

// --- Stability AI ($0.003/image) ---
async function generateWithStability(prompt: string, platform: Platform, apiKey: string): Promise<{ imageUrl: string; prompt: string }> {
  const size = IMAGE_SIZES[platform];
  // Stability supports specific aspect ratios
  const aspectRatio = size.width > size.height ? '16:9' : size.width < size.height ? '9:16' : '1:1';

  const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3-medium', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    body: (() => {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspect_ratio', aspectRatio);
      formData.append('output_format', 'png');
      return formData;
    })(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Stability AI error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const base64 = data.image;
  const imageUrl = `data:image/png;base64,${base64}`;

  return { imageUrl, prompt };
}

// --- OpenAI DALL-E ---
async function generateWithOpenAI(prompt: string, apiKey: string): Promise<{ imageUrl: string; prompt: string }> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI DALL-E error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return { imageUrl: data.data[0].url, prompt };
}

// --- Replicate (Flux) ---
async function generateWithReplicate(prompt: string, apiKey: string): Promise<{ imageUrl: string; prompt: string }> {
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      version: 'black-forest-labs/flux-schnell',
      input: { prompt, num_outputs: 1 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Replicate error ${response.status}: ${err}`);
  }

  const prediction = await response.json();

  // Poll for result
  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    result = await poll.json();
  }

  if (result.status === 'failed') {
    throw new Error(`Replicate generation failed: ${result.error}`);
  }

  return { imageUrl: result.output[0], prompt };
}

// --- Free placeholder (SVG-based cosmic card) ---
function generatePlaceholder(prompt: string, platform: Platform, zodiacSign?: ZodiacSign): { imageUrl: string; prompt: string } {
  const size = IMAGE_SIZES[platform];
  const sign = zodiacSign ? ZODIAC_EMOJI[zodiacSign] : '\u2728';
  const signName = zodiacSign ? ZODIAC_RU[zodiacSign] : 'YupSoul';

  // Generate a cosmic-themed SVG placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0D0D1A"/>
        <stop offset="40%" stop-color="#1A1A3E"/>
        <stop offset="100%" stop-color="#2D1B69"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="40%">
        <stop offset="0%" stop-color="#B794F6" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
    <text x="50%" y="40%" text-anchor="middle" font-size="120" fill="#D4A574">${sign}</text>
    <text x="50%" y="55%" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#F7FAFC" font-weight="bold">${signName}</text>
    <text x="50%" y="65%" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#A0AEC0">YupSoul</text>
  </svg>`;

  const imageUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return { imageUrl, prompt };
}
