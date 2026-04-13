// ============================================================
// Content Factory — File-based Database (Vercel KV alternative)
// Uses Vercel Blob or local JSON files for zero-cost storage
// ============================================================
import type { ContentItem, ContentPlan, DailyReport } from './types';

// In-memory store with Vercel KV-compatible interface
// On Vercel free tier we use KV (1GB free) or fall back to edge config
// For the skeleton, we use a simple in-memory + JSON approach

interface DB {
  plans: ContentPlan[];
  items: ContentItem[];
  reports: DailyReport[];
}

let store: DB = {
  plans: [],
  items: [],
  reports: [],
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

// --- Utility ---
export function generateId(): string {
  return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
