// ============================================================
// Content Factory — File-based Database (Vercel KV alternative)
// Uses Vercel Blob or local JSON files for zero-cost storage
// ============================================================
import type { ContentItem, ContentPlan, DailyReport } from './types';

// In-memory store with Vercel KV-compatible interface
// On Vercel free tier we use KV (1GB free) or fall back to edge config
// For the skeleton, we use a simple in-memory + JSON approach

interface AppSettings {
  deliveryHours: number[]; // Tbilisi hours when daily cron sends carousels
  usedThemes: Array<{ theme: string; usedAt: string }>; // ISO timestamps
}

interface DB {
  plans: ContentPlan[];
  items: ContentItem[];
  reports: DailyReport[];
  settings: AppSettings;
}

function parseDeliveryHoursEnv(): number[] {
  return (process.env.DELIVERY_HOURS || '8,21')
    .split(',')
    .map(Number)
    .filter(h => !isNaN(h) && h >= 0 && h <= 23);
}

let store: DB = {
  plans: [],
  items: [],
  reports: [],
  settings: { deliveryHours: parseDeliveryHoursEnv(), usedThemes: [] },
};

// --- Vercel KV wrapper (will use @vercel/kv when deployed) ---
// For now, simple in-memory implementation that works both locally and on Vercel

export async function dbGet<K extends keyof DB>(collection: K): Promise<DB[K]> {
  // In production, replace with: await kv.get(collection)
  return store[collection];
}

export async function dbSet<K extends keyof DB>(collection: K, data: DB[K]): Promise<void> {
  // In production, replace with: await kv.set(collection, data)
  store[collection] = data;
}

// --- Content Items ---
export async function getContentItems(filter?: { status?: string; platform?: string }): Promise<ContentItem[]> {
  const items = await dbGet('items');
  return items.filter(item => {
    if (filter?.status && item.status !== filter.status) return false;
    if (filter?.platform && item.platform !== filter.platform) return false;
    return true;
  });
}

export async function upsertContentItem(item: ContentItem): Promise<void> {
  const items = await dbGet('items');
  const idx = items.findIndex(i => i.id === item.id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...item, updatedAt: new Date().toISOString() };
  } else {
    items.push({ ...item, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  await dbSet('items', items);
}

export async function getItemById(id: string): Promise<ContentItem | undefined> {
  const items = await dbGet('items');
  return items.find(i => i.id === id);
}

// --- Plans ---
export async function savePlan(plan: ContentPlan): Promise<void> {
  const plans = await dbGet('plans');
  plans.push(plan);
  await dbSet('plans', plans);
}

export async function getLatestPlan(): Promise<ContentPlan | undefined> {
  const plans = await dbGet('plans');
  return plans[plans.length - 1];
}

// --- Reports ---
export async function saveReport(report: DailyReport): Promise<void> {
  const reports = await dbGet('reports');
  reports.push(report);
  await dbSet('reports', reports);
}

export async function getReports(days: number = 7): Promise<DailyReport[]> {
  const reports = await dbGet('reports');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return reports.filter(r => new Date(r.date) >= cutoff);
}

// --- Schedule Settings ---
export function getDeliveryHours(): number[] {
  return [...store.settings.deliveryHours];
}

export function setDeliveryHours(hours: number[]): void {
  store.settings.deliveryHours = hours.filter(h => h >= 0 && h <= 23).sort((a, b) => a - b);
}

// --- Theme statistics ---
export function recordUsedTheme(theme: string): void {
  store.settings.usedThemes.push({ theme, usedAt: new Date().toISOString() });
  if (store.settings.usedThemes.length > 200) {
    store.settings.usedThemes.splice(0, store.settings.usedThemes.length - 200);
  }
}

export function getRecentThemes(days = 7): string[] {
  const cutoff = Date.now() - days * 86_400_000;
  return store.settings.usedThemes
    .filter(u => new Date(u.usedAt).getTime() > cutoff)
    .map(u => u.theme);
}

export function getUsedThemesLog(limit = 10): Array<{ theme: string; usedAt: string }> {
  return store.settings.usedThemes.slice(-limit).reverse();
}

// --- Utility ---
export function generateId(): string {
  return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
