// ============================================================
// Tests — Config (YupSoul)
// ============================================================
import { getEnabledPlatforms, getActiveLLMProvider, getActiveImageProvider } from '../../src/lib/config';
import type { AppConfig } from '../../src/lib/types';

const baseConfig: AppConfig = {
  brand: {
    name: 'YupSoul',
    description: 'Test',
    targetAudience: '',
    tone: 'mystical',
    topics: [],
    colors: { primary: '#2D1B69', secondary: '#1A1A3E', accent: '#D4A574' },
    language: 'ru',
  },
  generation: {},
  platforms: {},
  schedule: {
    timezone: 'Europe/Moscow',
    postsPerDay: {},
    publishTimes: {},
  },
};

describe('getEnabledPlatforms', () => {
  test('returns empty when no platforms configured', () => {
    expect(getEnabledPlatforms(baseConfig)).toEqual([]);
  });

  test('returns telegram when configured', () => {
    const config = {
      ...baseConfig,
      platforms: {
        telegram: { botToken: 'test', channelId: '@test', reportChatId: '123' },
      },
    };
    expect(getEnabledPlatforms(config)).toEqual(['telegram']);
  });

  test('returns multiple platforms', () => {
    const config = {
      ...baseConfig,
      platforms: {
        telegram: { botToken: 'test', channelId: '@test', reportChatId: '123' },
        vk: { accessToken: 'test', groupId: '123' },
      },
    };
    const platforms = getEnabledPlatforms(config);
    expect(platforms).toContain('telegram');
    expect(platforms).toContain('vk');
    expect(platforms).toHaveLength(2);
  });
});

describe('getActiveLLMProvider', () => {
  test('returns null when no keys', () => {
    expect(getActiveLLMProvider(baseConfig)).toBeNull();
  });

  test('gemini is highest priority', () => {
    const config = {
      ...baseConfig,
      generation: { geminiApiKey: 'test', anthropicApiKey: 'test' },
    };
    expect(getActiveLLMProvider(config)).toBe('gemini');
  });

  test('deepseek is second priority', () => {
    const config = {
      ...baseConfig,
      generation: { deepseekApiKey: 'test', anthropicApiKey: 'test' },
    };
    expect(getActiveLLMProvider(config)).toBe('deepseek');
  });

  test('ollama is third priority', () => {
    const config = {
      ...baseConfig,
      generation: { ollamaBaseUrl: 'http://localhost:11434' },
    };
    expect(getActiveLLMProvider(config)).toBe('ollama');
  });

  test('anthropic fallback', () => {
    const config = {
      ...baseConfig,
      generation: { anthropicApiKey: 'sk-ant-test' },
    };
    expect(getActiveLLMProvider(config)).toBe('anthropic');
  });
});

describe('getActiveImageProvider', () => {
  test('returns null when no keys', () => {
    expect(getActiveImageProvider(baseConfig)).toBeNull();
  });

  test('stability is first', () => {
    const config = {
      ...baseConfig,
      generation: { stabilityApiKey: 'test', openaiApiKey: 'test' },
    };
    expect(getActiveImageProvider(config)).toBe('stability');
  });
});
