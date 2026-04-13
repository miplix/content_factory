// ============================================================
// Tests — Validator (Spock) for YupSoul
// ============================================================
import { validateConfig, validateContentItem } from '../../src/lib/validator';
import type { AppConfig, ContentItem } from '../../src/lib/types';

const mockConfig: AppConfig = {
  brand: {
    name: 'YupSoul',
    description: 'Telegram Mini App for cosmic melodies',
    targetAudience: 'Women 18-40, astrology',
    tone: 'mystical',
    topics: ['zodiac_sound', 'compatibility', 'daily_energy'],
    colors: { primary: '#2D1B69', secondary: '#1A1A3E', accent: '#D4A574' },
    language: 'ru',
    botUrl: 'https://t.me/Yup_Soul_bot?start=ref_miplix',
  },
  generation: {
    geminiApiKey: 'test-key',
  },
  platforms: {
    telegram: {
      botToken: '123:ABC',
      channelId: '@testchannel',
      reportChatId: '12345',
    },
  },
  schedule: {
    timezone: 'Europe/Moscow',
    postsPerDay: { telegram: 3 },
    publishTimes: { telegram: ['09:00', '15:00', '20:00'] },
  },
};

describe('validateConfig', () => {
  test('valid config passes', () => {
    const result = validateConfig(mockConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing brand name fails', () => {
    const config = { ...mockConfig, brand: { ...mockConfig.brand, name: 'My Product' } };
    const result = validateConfig(config);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('missing LLM key fails', () => {
    const config = {
      ...mockConfig,
      generation: {},
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  test('no platforms fails', () => {
    const config = { ...mockConfig, platforms: {} };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  test('gemini detected as LLM provider', () => {
    const result = validateConfig(mockConfig);
    const llmCheck = result.checks.find(c => c.name === 'generation.llm');
    expect(llmCheck?.passed).toBe(true);
    expect(llmCheck?.message).toContain('Gemini');
  });
});

describe('validateContentItem', () => {
  const mockItem: ContentItem = {
    id: 'test_1',
    title: 'Test Topic',
    topic: 'Test Topic',
    platform: 'telegram',
    format: 'text',
    status: 'generated',
    text: 'Check out your cosmic melody at YupSoul!',
    hashtags: ['#astrology', '#zodiac', '#yupsoul'],
    scheduledAt: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test('valid item passes', () => {
    const result = validateContentItem(mockItem);
    expect(result.valid).toBe(true);
  });

  test('empty text fails', () => {
    const item = { ...mockItem, text: '' };
    const result = validateContentItem(item);
    expect(result.valid).toBe(false);
  });

  test('text too long for twitter fails', () => {
    const item = { ...mockItem, platform: 'twitter' as const, text: 'a'.repeat(300) };
    const result = validateContentItem(item);
    expect(result.valid).toBe(false);
  });

  test('instagram without image fails', () => {
    const item = { ...mockItem, platform: 'instagram' as const, format: 'image' as const };
    const result = validateContentItem(item);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('spam detection warns', () => {
    const item = { ...mockItem, text: 'Заработай без вложений уже сегодня!' };
    const result = validateContentItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('few hashtags warns', () => {
    const item = { ...mockItem, hashtags: ['one'] };
    const result = validateContentItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('missing YupSoul CTA warns', () => {
    const item = { ...mockItem, text: 'Just a random post without brand mention' };
    const result = validateContentItem(item);
    const ctaCheck = result.checks.find(c => c.name === 'yupsoul.cta');
    expect(ctaCheck?.passed).toBe(false);
  });

  test('YupSoul CTA present passes', () => {
    const result = validateContentItem(mockItem);
    const ctaCheck = result.checks.find(c => c.name === 'yupsoul.cta');
    expect(ctaCheck?.passed).toBe(true);
  });
});
