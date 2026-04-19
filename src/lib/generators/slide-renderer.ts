// ============================================================
// Content Factory — Slide Renderer (YupSoul)
// Renders TikTok carousel slides as PNG images using Satori + Resvg
// 1080x1920 cosmic-themed slides for TikTok 9:16
// ============================================================
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import type { ZodiacSign } from '../types';
import { ZODIAC_RU } from '../types';

const SLIDE_W = 1080;
const SLIDE_H = 1920;

// Cosmic palette
const COLORS = {
  deepSpace: '#0D0D1A',
  cosmicBlue: '#1A1A3E',
  deepPurple: '#2D1B69',
  softGold: '#D4A574',
  neonLavender: '#B794F6',
  cosmicPink: '#F687B3',
  starWhite: '#F7FAFC',
  nebulaGray: '#A0AEC0',
};

// Lazy-loaded font cache
let fontRegular: ArrayBuffer | null = null;
let fontBold: ArrayBuffer | null = null;
let fontEmoji: ArrayBuffer | null = null;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function loadFonts() {
  if (fontRegular && fontBold && fontEmoji) return { fontRegular, fontBold, fontEmoji };

  const candidates = [
    path.join(process.cwd(), 'src/lib/fonts'),
    path.join(__dirname, '../fonts'),
    path.join(__dirname, '../../lib/fonts'),
  ];

  for (const dir of candidates) {
    const regularPath = path.join(dir, 'Inter-Regular.ttf');
    const boldPath = path.join(dir, 'Inter-Bold.ttf');
    const emojiPath = path.join(dir, 'NotoEmoji-Regular.ttf');
    if (fs.existsSync(regularPath) && fs.existsSync(boldPath) && fs.existsSync(emojiPath)) {
      fontRegular = toArrayBuffer(fs.readFileSync(regularPath));
      fontBold = toArrayBuffer(fs.readFileSync(boldPath));
      fontEmoji = toArrayBuffer(fs.readFileSync(emojiPath));
      return { fontRegular, fontBold, fontEmoji };
    }
  }

  throw new Error(`Fonts not found. Tried: ${candidates.join(', ')}`);
}

export interface SlideContent {
  text: string;
  description?: string;
  slideNumber: number;
  totalSlides: number;
  zodiacSign?: ZodiacSign;
  zodiacSign2?: ZodiacSign;
  isCover?: boolean;
  isCTA?: boolean;
}

// Auto-fit font size based on text length
function pickFontSize(text: string, isCover: boolean): number {
  const len = text.length;
  if (isCover) {
    if (len < 40) return 84;
    if (len < 80) return 68;
    if (len < 120) return 56;
    return 48;
  }
  if (len < 50) return 72;
  if (len < 100) return 60;
  if (len < 150) return 52;
  if (len < 220) return 44;
  return 38;
}

// Generate deterministic star positions (seeded)
function generateStars(count: number) {
  const stars: { top: number; left: number; size: number; opacity: number }[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      top: (i * 137) % 100,
      left: (i * 73) % 100,
      size: ((i * 41) % 3) + 1,
      opacity: (((i * 23) % 5) + 1) / 10,
    });
  }
  return stars;
}

// Build slide as a satori-compatible JSX tree (using object literals)
function buildSlideTree(content: SlideContent) {
  const text = content.text.trim();
  const description = content.description?.trim();
  const fontSize = pickFontSize(text, content.isCover || false);
  const accentColor = content.isCTA ? COLORS.softGold : COLORS.starWhite;

  // Background gradient varies by slide type
  const bgGradient = content.isCTA
    ? `linear-gradient(135deg, ${COLORS.deepPurple} 0%, ${COLORS.cosmicBlue} 50%, ${COLORS.softGold}40 100%)`
    : `linear-gradient(135deg, ${COLORS.deepSpace} 0%, ${COLORS.cosmicBlue} 50%, ${COLORS.deepPurple} 100%)`;

  const stars = generateStars(40);
  const signName = content.zodiacSign
    ? content.zodiacSign2
      ? `${ZODIAC_RU[content.zodiacSign].toUpperCase()} / ${ZODIAC_RU[content.zodiacSign2].toUpperCase()}`
      : ZODIAC_RU[content.zodiacSign].toUpperCase()
    : 'YUPSOUL';

  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        background: bgGradient,
        display: 'flex',
        position: 'relative',
        fontFamily: 'Inter, NotoEmoji',
      },
      children: [
        // Stars layer
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
            },
            children: stars.map((s, i) => ({
              type: 'div',
              key: `star-${i}`,
              props: {
                style: {
                  position: 'absolute',
                  top: `${s.top}%`,
                  left: `${s.left}%`,
                  width: `${s.size * 3}px`,
                  height: `${s.size * 3}px`,
                  background: COLORS.starWhite,
                  borderRadius: '50%',
                  opacity: s.opacity,
                },
                children: '',
              },
            })),
          },
        },
        // Center content
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              padding: '160px 0',
            },
            children: [
              // Zodiac sign name (gold accent badge)
              ...(content.zodiacSign
                ? [{
                    type: 'div',
                    props: {
                      style: {
                        fontSize: content.isCover ? '38px' : '30px',
                        color: COLORS.softGold,
                        fontWeight: 700,
                        letterSpacing: '8px',
                        padding: '14px 36px',
                        border: `2px solid ${COLORS.softGold}`,
                        borderRadius: '50px',
                        marginBottom: '60px',
                        display: 'flex',
                        background: 'rgba(212, 165, 116, 0.08)',
                      },
                      children: signName,
                    },
                  }]
                : []),
              // Main text
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: `${fontSize}px`,
                    color: accentColor,
                    fontWeight: 700,
                    textAlign: 'center',
                    lineHeight: 1.25,
                    padding: '0 80px',
                    maxWidth: '1000px',
                    letterSpacing: '-0.5px',
                    display: 'flex',
                  },
                  children: text,
                },
              },
              // Description (if present)
              ...(description
                ? [{
                    type: 'div',
                    props: {
                      style: {
                        fontSize: '32px',
                        color: COLORS.nebulaGray,
                        marginTop: '40px',
                        textAlign: 'center',
                        padding: '0 100px',
                        maxWidth: '900px',
                        lineHeight: 1.4,
                        fontWeight: 400,
                        display: 'flex',
                      },
                      children: description,
                    },
                  }]
                : []),
            ],
          },
        },
        // Brand (bottom)
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '70px',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              fontSize: '32px',
              color: COLORS.softGold,
              fontWeight: 700,
              letterSpacing: '6px',
            },
            children: '\u2728  YUPSOUL  \u2728',
          },
        },
      ],
    },
  };
}

// Convert a JS string (possibly a multi-codepoint emoji) into the dash-joined hex
// twemoji uses in its filenames. Drops variation selectors (U+FE0F) but keeps ZWJs.
function twemojiCodePoint(text: string): string {
  const parts: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xfe0f) continue;
    parts.push(cp.toString(16));
  }
  return parts.join('-');
}

// Small per-process cache so repeat emojis within one render pass hit memory.
const twemojiCache = new Map<string, string>();

async function fetchTwemojiDataUrl(emoji: string): Promise<string | undefined> {
  const code = twemojiCodePoint(emoji);
  if (!code) return undefined;
  const cached = twemojiCache.get(code);
  if (cached !== undefined) return cached || undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`,
      { signal: controller.signal },
    );
    if (!res.ok) {
      twemojiCache.set(code, '');
      return undefined;
    }
    const svg = await res.text();
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    twemojiCache.set(code, dataUrl);
    return dataUrl;
  } catch {
    twemojiCache.set(code, '');
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

// Render single slide to PNG buffer
export async function renderSlide(content: SlideContent): Promise<Buffer> {
  const { fontRegular: fr, fontBold: fb, fontEmoji: fe } = loadFonts();
  const tree = buildSlideTree(content);

  const svg = await satori(tree as never, {
    width: SLIDE_W,
    height: SLIDE_H,
    fonts: [
      { name: 'Inter', data: fr, weight: 400, style: 'normal' },
      { name: 'Inter', data: fb, weight: 700, style: 'normal' },
      { name: 'NotoEmoji', data: fe, weight: 400, style: 'normal' },
    ],
    loadAdditionalAsset: async (code: string, segment: string) => {
      if (code === 'emoji') {
        // data URL → coloured twemoji image; [] → fall back to NotoEmoji
        return (await fetchTwemojiDataUrl(segment)) ?? [];
      }
      return [];
    },
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: SLIDE_W },
    background: COLORS.deepSpace,
  });

  const pngData = resvg.render().asPng();
  return Buffer.from(pngData);
}

// Render all slides of a carousel
export async function renderCarousel(slides: SlideContent[]): Promise<Buffer[]> {
  const total = slides.length;
  const results: Buffer[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = {
      ...slides[i],
      slideNumber: i + 1,
      totalSlides: total,
      isCover: i === 0,
      isCTA: i === slides.length - 1,
    };
    const png = await renderSlide(slide);
    results.push(png);
  }

  return results;
}
