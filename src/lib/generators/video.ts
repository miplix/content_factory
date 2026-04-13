// ============================================================
// Content Factory — Video Generator
// Creates video from images + audio (slideshow style)
// Uses free/cheap APIs where possible
// ============================================================
import type { BrandConfig, Platform } from '../types';

export interface VideoGenResult {
  videoUrl?: string;
  audioUrl?: string;
  slidesData: SlideData[];
  provider: 'assembled' | 'replicate' | 'manual';
  duration: number; // seconds
  status: 'ready' | 'needs_assembly' | 'failed';
  instructions?: string; // If manual assembly needed
}

export interface SlideData {
  imageUrl: string;
  text: string;
  duration: number; // seconds per slide
  voiceoverText?: string;
}

const PLATFORM_VIDEO_SPECS: Record<Platform, { width: number; height: number; maxDuration: number }> = {
  tiktok: { width: 1080, height: 1920, maxDuration: 60 },
  instagram: { width: 1080, height: 1920, maxDuration: 90 }, // Reels
  youtube: { width: 1920, height: 1080, maxDuration: 600 },  // Shorts: 60s
  telegram: { width: 1280, height: 720, maxDuration: 300 },
  vk: { width: 1280, height: 720, maxDuration: 300 },
  twitter: { width: 1280, height: 720, maxDuration: 140 },
};

// --- TTS with ElevenLabs (free tier: 10k chars/month) ---
async function generateVoiceover(text: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs error: ${response.status}`);
  }

  // Convert to base64 data URL (for Vercel serverless)
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

// --- Build slide data from script ---
export function parseScriptToSlides(script: string, totalDuration: number): SlideData[] {
  // Split script into logical parts
  const parts = script.split(/\n\n+/).filter(Boolean);
  const durationPerSlide = Math.floor(totalDuration / parts.length);

  return parts.map((text, i) => ({
    imageUrl: '', // Will be filled by image generator
    text: text.trim(),
    duration: i === 0 ? durationPerSlide + 1 : durationPerSlide, // Extra second for hook
    voiceoverText: text.trim(),
  }));
}

// --- Main video generation pipeline ---
export async function generateVideo(params: {
  script: string;
  platform: Platform;
  brand: BrandConfig;
  imageUrls: string[];
  elevenLabsApiKey?: string;
}): Promise<VideoGenResult> {
  const { script, platform, brand, imageUrls, elevenLabsApiKey } = params;
  const specs = PLATFORM_VIDEO_SPECS[platform];

  // Parse script into slides
  const targetDuration = Math.min(45, specs.maxDuration); // Default: 45 seconds
  const slides = parseScriptToSlides(script, targetDuration);

  // Assign images to slides
  slides.forEach((slide, i) => {
    slide.imageUrl = imageUrls[i % imageUrls.length] || '';
  });

  // Generate voiceover if API key available
  let audioUrl: string | undefined;
  if (elevenLabsApiKey) {
    try {
      const fullText = slides.map(s => s.voiceoverText).join('. ');
      audioUrl = await generateVoiceover(fullText, elevenLabsApiKey);
    } catch (e) {
      console.error('Voiceover generation failed:', e);
    }
  }

  // On Vercel serverless, we can't run ffmpeg
  // So we return slide data for client-side assembly or external service
  return {
    audioUrl,
    slidesData: slides,
    provider: 'assembled',
    duration: targetDuration,
    status: 'needs_assembly',
    instructions: `Video assembly required. ${slides.length} slides, ${targetDuration}s total. ` +
      `Format: ${specs.width}x${specs.height}. ` +
      `Use client-side Canvas API or external ffmpeg service to combine.`,
  };
}

export { PLATFORM_VIDEO_SPECS };
