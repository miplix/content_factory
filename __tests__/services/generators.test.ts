// ============================================================
// Тесты — Генераторы (юнит-тесты, без вызовов API)
// ============================================================
import { parseScriptToSlides, PLATFORM_VIDEO_SPECS } from '../../src/lib/generators/video';
import { ZODIAC_RU, ZODIAC_EMOJI, ZODIAC_SIGNS, RUBRIC_RU } from '../../src/lib/types';

describe('Video Generator', () => {
  test('parseScriptToSlides корректно разделяет скрипт', () => {
    const script = `Первый слайд с контентом.

Второй слайд с текстом.

Третий и финальный слайд.`;

    const slides = parseScriptToSlides(script, 30);
    expect(slides).toHaveLength(3);
    expect(slides[0].text).toBe('Первый слайд с контентом.');
    expect(slides[1].text).toBe('Второй слайд с текстом.');
    expect(slides[2].text).toBe('Третий и финальный слайд.');
  });

  test('длительность слайдов примерно равна общей', () => {
    const script = `Часть 1\n\nЧасть 2\n\nЧасть 3\n\nЧасть 4`;
    const totalDuration = 40;
    const slides = parseScriptToSlides(script, totalDuration);
    const totalSlideTime = slides.reduce((s, slide) => s + slide.duration, 0);
    expect(Math.abs(totalSlideTime - totalDuration)).toBeLessThanOrEqual(2);
  });

  test('все платформы имеют спецификации видео', () => {
    const platforms = ['tiktok', 'instagram', 'youtube', 'telegram', 'vk', 'twitter'];
    for (const p of platforms) {
      expect(PLATFORM_VIDEO_SPECS[p as keyof typeof PLATFORM_VIDEO_SPECS]).toBeDefined();
    }
  });
});

describe('YupSoul Types', () => {
  test('12 знаков зодиака', () => {
    expect(ZODIAC_SIGNS).toHaveLength(12);
  });

  test('все знаки имеют русские названия', () => {
    for (const sign of ZODIAC_SIGNS) {
      expect(ZODIAC_RU[sign]).toBeDefined();
      expect(ZODIAC_RU[sign].length).toBeGreaterThan(0);
    }
  });

  test('все знаки имеют эмодзи', () => {
    for (const sign of ZODIAC_SIGNS) {
      expect(ZODIAC_EMOJI[sign]).toBeDefined();
    }
  });

  test('20 рубрик контента', () => {
    const rubrics = Object.keys(RUBRIC_RU);
    expect(rubrics).toHaveLength(20);
  });

  test('Овен — первый знак', () => {
    expect(ZODIAC_SIGNS[0]).toBe('aries');
    expect(ZODIAC_RU['aries']).toBe('Овен');
  });

  test('рубрика daily_energy существует', () => {
    expect(RUBRIC_RU['daily_energy']).toBe('Энергия дня');
  });
});
