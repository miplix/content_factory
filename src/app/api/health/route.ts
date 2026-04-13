// ============================================================
// Health Check API — Spock checks all services
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig, getEnabledPlatforms, getActiveLLMProvider, getActiveImageProvider } from '@/lib/config';
import { validateConfig } from '@/lib/validator';
import { checkAllPlatforms } from '@/lib/publishers';

export const runtime = 'nodejs';

export async function GET() {
  const config = loadConfig();
  const validation = validateConfig(config);
  const platforms = getEnabledPlatforms(config);
  const llmProvider = getActiveLLMProvider(config);
  const imageProvider = getActiveImageProvider(config);

  // Check platform connections
  let platformChecks: Record<string, { ok: boolean; details?: string; error?: string }> = {};
  try {
    platformChecks = await checkAllPlatforms(config);
  } catch (error) {
    platformChecks = { _error: { ok: false, error: String(error) } };
  }

  const allOk = validation.valid &&
    Object.values(platformChecks).every(c => c.ok);

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    brand: config.brand.name,
    timestamp: new Date().toISOString(),
    config: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    llm: {
      provider: llmProvider || 'none',
      model: llmProvider === 'gemini' ? config.generation.geminiModel
        : llmProvider === 'ollama' ? config.generation.ollamaModel
        : llmProvider || 'n/a',
    },
    imageProvider: imageProvider || 'placeholder',
    platforms: {
      enabled: platforms,
      checks: platformChecks,
    },
    schedule: config.schedule,
  });
}
