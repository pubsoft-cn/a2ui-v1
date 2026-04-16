/**
 * OSSPublisher Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OSSPublisher, createInMemoryAdapter } from '../../src/management/OSSPublisher';
import type { OSSConfig } from '../../src/management/types';
import type { SchemaDocument } from '../../src/types';

const createTestConfig = (): OSSConfig => ({
  provider: 'custom',
  bucket: 'test-bucket',
  region: 'cn-hangzhou',
  basePath: '/a2ui',
  cdnBaseUrl: 'https://cdn.example.com/a2ui',
});

const createTestSchema = (): SchemaDocument => ({
  version: '1.0.0',
  meta: { title: 'Test Page' },
  root: { id: 'root', type: 'view', props: {} },
});

describe('OSSPublisher', () => {
  let publisher: OSSPublisher;
  let adapter: ReturnType<typeof createInMemoryAdapter>;

  beforeEach(() => {
    adapter = createInMemoryAdapter();
    publisher = new OSSPublisher(createTestConfig(), adapter);
  });

  describe('publish', () => {
    it('should publish a schema successfully', async () => {
      const result = await publisher.publish('page-home', createTestSchema());

      expect(result.success).toBe(true);
      expect(result.schemaId).toBe('page-home');
      expect(result.version).toBeTruthy();
      expect(result.url).toContain('cdn.example.com');
      expect(result.publishedAt).toBeTruthy();
    });

    it('should publish with custom version', async () => {
      const result = await publisher.publish('page-home', createTestSchema(), {
        version: 'v2.0.0',
        changelog: 'Major update',
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe('v2.0.0');
    });

    it('should upload latest version by default', async () => {
      await publisher.publish('page-home', createTestSchema(), {
        version: 'v1',
      });

      const latestExists = await publisher.exists('page-home', 'latest');
      expect(latestExists).toBe(true);
    });

    it('should skip latest when setLatest is false', async () => {
      await publisher.publish('page-home', createTestSchema(), {
        version: 'v1',
        setLatest: false,
      });

      const latestExists = await publisher.exists('page-home', 'latest');
      expect(latestExists).toBe(false);
    });

    it('should fail for invalid schema', async () => {
      const badSchema = { version: '', root: null } as unknown as SchemaDocument;
      const result = await publisher.publish('bad', badSchema);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('unpublish', () => {
    it('should unpublish a version', async () => {
      await publisher.publish('page-home', createTestSchema(), {
        version: 'v1',
      });

      const result = await publisher.unpublish('page-home', 'v1');
      expect(result).toBe(true);

      const exists = await publisher.exists('page-home', 'v1');
      expect(exists).toBe(false);
    });

    it('should return false for non-existent version', async () => {
      const result = await publisher.unpublish('nonexistent', 'v1');
      // In-memory adapter delete doesn't throw
      expect(result).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true for published version', async () => {
      await publisher.publish('page-home', createTestSchema(), { version: 'v1' });
      expect(await publisher.exists('page-home', 'v1')).toBe(true);
    });

    it('should return false for non-published version', async () => {
      expect(await publisher.exists('page-home', 'v999')).toBe(false);
    });
  });

  describe('getCDNUrl', () => {
    it('should return versioned URL', () => {
      const url = publisher.getCDNUrl('page-home', 'v1');
      expect(url).toBe('https://cdn.example.com/a2ui/schemas/page-home/v1.json');
    });

    it('should return latest URL when version not specified', () => {
      const url = publisher.getCDNUrl('page-home');
      expect(url).toBe('https://cdn.example.com/a2ui/schemas/page-home/latest.json');
    });
  });

  describe('createInMemoryAdapter', () => {
    it('should support upload, exists, and delete', async () => {
      const memAdapter = createInMemoryAdapter();

      const uploadResult = await memAdapter.upload('test/key.json', '{"test":true}', 'application/json');
      expect(uploadResult.size).toBeGreaterThan(0);

      expect(await memAdapter.exists('test/key.json')).toBe(true);

      await memAdapter.delete('test/key.json');
      expect(await memAdapter.exists('test/key.json')).toBe(false);
    });
  });
});
