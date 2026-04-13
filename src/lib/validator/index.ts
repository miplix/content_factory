// ============================================================
// Content Factory — Validator Agent (Spock / Spok)
// "Sem' raz otmer', odin raz otrezh'"
// Validates everything before it goes live
// ============================================================
import type { AppConfig, ContentItem, ValidationResult, ValidationCheck, Platform, LLMProvider } from '../types';
import { loadConfig, getEnabledPlatforms, getActiveLLMProvider, getActiveImageProvider } from '../config';

const PLATFORM_LIMITS: Record<Platform, { maxTextLength: number; requiresImage: boolean; requiresVideo: boolean }> = {
  telegram: { maxTextLength: 4096, requiresImage: false, requiresVideo: false },
  youtube: { maxTextLength: 5000, requiresImage: false, requiresVideo: true },
  instagram: { maxTextLength: 2200, requiresImage: true, requiresVideo: false },
  tiktok: { maxTextLength: 300, requiresImage: false, requiresVideo: true },
  vk: { maxTextLength: 4096, requiresImage: false, requiresVideo: false },
  twitter: { maxTextLength: 280, requiresImage: false, requiresVideo: false },
};

const LLM_PROVIDER_NAMES: Record<LLMProvider, string> = {
  gemini: 'Google Gemini (FREE)',
  deepseek: 'DeepSeek (FREE)',
  ollama: 'Ollama (FREE, local)',
  anthropic: 'Anthropic Claude (paid)',
  openai: 'OpenAI (paid)',
};

// --- Validate Config ---
export function validateConfig(config?: AppConfig): ValidationResult {
  const cfg = config || loadConfig();
  const checks: ValidationCheck[] = [];

  // Check brand
  checks.push({
    name: 'brand.name',
    passed: !!cfg.brand.name && cfg.brand.name !== 'My Product',
    message: cfg.brand.name && cfg.brand.name !== 'My Product'
      ? `Brand: "${cfg.brand.name}"`
      : 'BRAND_NAME not set or using default',
    severity: cfg.brand.name && cfg.brand.name !== 'My Product' ? 'info' : 'error',
  });

  checks.push({
    name: 'brand.description',
    passed: !!cfg.brand.description,
    message: cfg.brand.description ? 'Brand description set' : 'BRAND_DESCRIPTION not set',
    severity: cfg.brand.description ? 'info' : 'error',
  });

  checks.push({
    name: 'brand.topics',
    passed: cfg.brand.topics.length > 0,
    message: cfg.brand.topics.length > 0
      ? `${cfg.brand.topics.length} topics configured`
      : 'BRAND_TOPICS not set',
    severity: cfg.brand.topics.length > 0 ? 'info' : 'error',
  });

  // Check LLM provider (free-first priority)
  const llmProvider = getActiveLLMProvider(cfg);
  checks.push({
    name: 'generation.llm',
    passed: !!llmProvider,
    message: llmProvider
      ? `LLM: ${LLM_PROVIDER_NAMES[llmProvider]}`
      : 'No LLM configured. Set GEMINI_API_KEY (free), DEEPSEEK_API_KEY (free), OLLAMA_BASE_URL (free), or ANTHROPIC_API_KEY',
    severity: llmProvider ? 'info' : 'error',
  });

  // Check image provider
  const imageProvider = getActiveImageProvider(cfg);
  checks.push({
    name: 'generation.image',
    passed: !!imageProvider,
    message: imageProvider
      ? `Images: ${imageProvider}`
      : 'No image API configured (will use placeholder SVG)',
    severity: imageProvider ? 'info' : 'warning',
  });

  // Check TTS
  const hasTTS = !!(cfg.generation.fishAudioApiKey || cfg.generation.elevenLabsApiKey);
  checks.push({
    name: 'generation.tts',
    passed: hasTTS,
    message: hasTTS
      ? `TTS: ${cfg.generation.fishAudioApiKey ? 'Fish Audio' : 'ElevenLabs'}`
      : 'No TTS configured (video will be without voiceover)',
    severity: hasTTS ? 'info' : 'warning',
  });

  // Check platforms
  const platforms = getEnabledPlatforms(cfg);
  checks.push({
    name: 'platforms.count',
    passed: platforms.length > 0,
    message: platforms.length > 0
      ? `${platforms.length} platforms: ${platforms.join(', ')}`
      : 'No platforms configured',
    severity: platforms.length > 0 ? 'info' : 'error',
  });

  // Check Telegram (primary platform)
  if (cfg.platforms.telegram) {
    checks.push({
      name: 'telegram.reportChatId',
      passed: !!cfg.platforms.telegram.reportChatId,
      message: cfg.platforms.telegram.reportChatId
        ? 'Telegram report chat configured'
        : 'TELEGRAM_REPORT_CHAT_ID not set — reports will not be sent',
      severity: cfg.platforms.telegram.reportChatId ? 'info' : 'warning',
    });
  }

  // Check schedule
  checks.push({
    name: 'schedule.timezone',
    passed: !!cfg.schedule.timezone,
    message: `Timezone: ${cfg.schedule.timezone}`,
    severity: 'info',
  });

  // YupSoul-specific checks
  checks.push({
    name: 'yupsoul.botUrl',
    passed: !!cfg.brand.botUrl,
    message: cfg.brand.botUrl
      ? `Bot: ${cfg.brand.botUrl}`
      : 'BRAND_BOT_URL not set — CTA links will be missing',
    severity: cfg.brand.botUrl ? 'info' : 'warning',
  });

  const errors = checks.filter(c => !c.passed && c.severity === 'error');
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning');

  return {
    valid: errors.length === 0,
    errors: errors.map(e => e.message),
    warnings: warnings.map(w => w.message),
    checks,
  };
}

// --- Validate Content Item Before Publishing ---
export function validateContentItem(item: ContentItem): ValidationResult {
  const checks: ValidationCheck[] = [];
  const limits = PLATFORM_LIMITS[item.platform];

  // Check text length
  const textLength = (item.text || '').length;
  checks.push({
    name: 'text.length',
    passed: textLength > 0 && textLength <= limits.maxTextLength,
    message: textLength === 0
      ? 'Text is empty'
      : textLength > limits.maxTextLength
        ? `Text too long: ${textLength}/${limits.maxTextLength}`
        : `Text: ${textLength}/${limits.maxTextLength} chars`,
    severity: textLength === 0 ? 'error' : textLength > limits.maxTextLength ? 'error' : 'info',
  });

  // Check media requirements
  if (limits.requiresImage && !item.imageUrl && !item.videoUrl) {
    checks.push({
      name: 'media.required',
      passed: false,
      message: `${item.platform} requires image or video`,
      severity: 'error',
    });
  }

  if (limits.requiresVideo && !item.videoUrl) {
    checks.push({
      name: 'video.required',
      passed: false,
      message: `${item.platform} requires video`,
      severity: item.format === 'text' ? 'warning' : 'error',
    });
  }

  // Check hashtags
  checks.push({
    name: 'hashtags.count',
    passed: (item.hashtags?.length || 0) >= 3,
    message: (item.hashtags?.length || 0) >= 3
      ? `${item.hashtags!.length} hashtags`
      : `Few hashtags: ${item.hashtags?.length || 0} (recommend 3+)`,
    severity: (item.hashtags?.length || 0) >= 3 ? 'info' : 'warning',
  });

  // Check for spam indicators
  const spamPatterns = [
    /zarabot(ok|aj|at')/i,
    /bez vlozhenij/i,
    /100% garantiya/i,
    /tol'ko segodnya/i,
    /срочно/i,
    /заработ(ок|ай|ать)/i,
    /без вложений/i,
    /100% гарантия/i,
    /только сегодня/i,
  ];
  const hasSpam = spamPatterns.some(p => p.test(item.text || ''));
  checks.push({
    name: 'text.spam',
    passed: !hasSpam,
    message: hasSpam ? 'Text contains spam markers — risk of being blocked' : 'Spam check passed',
    severity: hasSpam ? 'warning' : 'info',
  });

  // Check CTA presence (YupSoul-specific)
  const hasCTA = (item.text || '').includes('YupSoul') || (item.text || '').includes('yupsoul');
  checks.push({
    name: 'yupsoul.cta',
    passed: hasCTA,
    message: hasCTA ? 'CTA to YupSoul present' : 'No CTA to YupSoul — consider adding @YupSoul_bot link',
    severity: hasCTA ? 'info' : 'warning',
  });

  // Check scheduled date
  if (item.scheduledAt) {
    const scheduled = new Date(item.scheduledAt);
    const now = new Date();
    checks.push({
      name: 'schedule.date',
      passed: scheduled >= now || item.status === 'published',
      message: scheduled >= now || item.status === 'published'
        ? `Scheduled: ${item.scheduledAt}`
        : 'Scheduled date has passed',
      severity: scheduled >= now || item.status === 'published' ? 'info' : 'warning',
    });
  }

  const errors = checks.filter(c => !c.passed && c.severity === 'error');
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning');

  return {
    valid: errors.length === 0,
    errors: errors.map(e => e.message),
    warnings: warnings.map(w => w.message),
    checks,
  };
}

// --- Full System Validation ---
export async function validateSystem(config?: AppConfig): Promise<{
  config: ValidationResult;
  summary: string;
}> {
  const configResult = validateConfig(config);

  const statusIcon = (passed: boolean, severity: string) => {
    if (passed) return '\u2705';
    return severity === 'error' ? '\u274C' : '\u26A0\uFE0F';
  };

  const summary = [
    '\uD83D\uDD96 SPOCK — System Validation (YupSoul)',
    '\u2550'.repeat(40),
    '',
    ...configResult.checks.map(c => `${statusIcon(c.passed, c.severity)} ${c.message}`),
    '',
    '\u2550'.repeat(40),
    configResult.valid
      ? '\u2705 System ready'
      : `\u274C ${configResult.errors.length} errors, ${configResult.warnings.length} warnings`,
    '',
    configResult.errors.length > 0 ? 'Errors:' : '',
    ...configResult.errors.map(e => `  \u274C ${e}`),
    configResult.warnings.length > 0 ? 'Warnings:' : '',
    ...configResult.warnings.map(w => `  \u26A0\uFE0F ${w}`),
  ].filter(line => line !== undefined).join('\n');

  return { config: configResult, summary };
}
