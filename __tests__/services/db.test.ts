// ============================================================
// Tests — Database
// ============================================================
import {
  getContentItems,
  upsertContentItem,
  getItemById,
  generateId,
} from '../../src/lib/db';
import type { ContentItem } from '../../src/lib/types';

describe('Database', () => {
  const mockItem: ContentItem = {
    id: 'test_db_1',
    title: 'Test',
    topic: 'Test Topic',
    platform: 'telegram',
    format: 'text',
    status: 'planned',
    scheduledAt: '2025-01-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test('generateId returns unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1.startsWith('cf_')).toBe(true);
  });

  test('upsert and retrieve item', async () => {
    await upsertContentItem(mockItem);
    const item = await getItemById('test_db_1');
    expect(item).toBeDefined();
    expect(item?.topic).toBe('Test Topic');
  });

  test('filter by status', async () => {
    await upsertContentItem(mockItem);
    await upsertContentItem({ ...mockItem, id: 'test_db_2', status: 'published' });

    const planned = await getContentItems({ status: 'planned' });
    expect(planned.some(i => i.id === 'test_db_1')).toBe(true);

    const published = await getContentItems({ status: 'published' });
    expect(published.some(i => i.id === 'test_db_2')).toBe(true);
  });

  test('filter by platform', async () => {
    await upsertContentItem(mockItem);
    await upsertContentItem({ ...mockItem, id: 'test_db_3', platform: 'instagram' });

    const tgItems = await getContentItems({ platform: 'telegram' });
    const igItems = await getContentItems({ platform: 'instagram' });

    expect(tgItems.some(i => i.platform === 'telegram')).toBe(true);
    expect(igItems.some(i => i.platform === 'instagram')).toBe(true);
  });

  test('upsert updates existing item', async () => {
    await upsertContentItem(mockItem);
    await upsertContentItem({ ...mockItem, status: 'published' });

    const item = await getItemById('test_db_1');
    expect(item?.status).toBe('published');
  });
});
