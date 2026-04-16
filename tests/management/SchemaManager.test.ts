/**
 * SchemaManager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaManager } from '../../src/management/SchemaManager';
import type { SchemaDocument } from '../../src/types';

const createTestSchema = (version = '1.0.0'): SchemaDocument => ({
  version,
  meta: { title: 'Test Page' },
  root: { id: 'root', type: 'view', props: {} },
  dataSources: [],
});

describe('SchemaManager', () => {
  let manager: SchemaManager;

  beforeEach(() => {
    manager = new SchemaManager();
  });

  describe('create', () => {
    it('should create a managed schema', () => {
      const schema = createTestSchema();
      const managed = manager.create('test-1', 'Test Schema', schema, {
        description: 'A test schema',
        author: 'tester',
        tags: ['test'],
      });

      expect(managed.id).toBe('test-1');
      expect(managed.name).toBe('Test Schema');
      expect(managed.status).toBe('draft');
      expect(managed.schema).toBe(schema);
      expect(managed.description).toBe('A test schema');
      expect(managed.author).toBe('tester');
      expect(managed.tags).toEqual(['test']);
      expect(managed.versions).toEqual([]);
    });

    it('should throw if schema ID already exists', () => {
      manager.create('test-1', 'First', createTestSchema());
      expect(() => manager.create('test-1', 'Second', createTestSchema())).toThrow(
        'already exists'
      );
    });
  });

  describe('get', () => {
    it('should return a schema by ID', () => {
      manager.create('test-1', 'Test', createTestSchema());
      const result = manager.get('test-1');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Test');
    });

    it('should return undefined for non-existent ID', () => {
      expect(manager.get('nonexistent')).toBeUndefined();
    });
  });

  describe('list', () => {
    beforeEach(() => {
      manager.create('s1', 'Schema 1', createTestSchema(), { author: 'alice', tags: ['page'] });
      manager.create('s2', 'Schema 2', createTestSchema(), { author: 'bob', tags: ['form'] });
      manager.create('s3', 'Schema 3', createTestSchema(), { author: 'alice', tags: ['page', 'form'] });
    });

    it('should list all schemas', () => {
      expect(manager.list()).toHaveLength(3);
    });

    it('should filter by status', () => {
      expect(manager.list({ status: 'draft' })).toHaveLength(3);
      expect(manager.list({ status: 'published' })).toHaveLength(0);
    });

    it('should filter by author', () => {
      expect(manager.list({ author: 'alice' })).toHaveLength(2);
      expect(manager.list({ author: 'bob' })).toHaveLength(1);
    });

    it('should filter by tags', () => {
      expect(manager.list({ tags: ['page'] })).toHaveLength(2);
      expect(manager.list({ tags: ['form'] })).toHaveLength(2);
    });
  });

  describe('updateSchema', () => {
    it('should update the schema document', () => {
      manager.create('test-1', 'Test', createTestSchema('1.0.0'));
      const newSchema = createTestSchema('2.0.0');
      const updated = manager.updateSchema('test-1', newSchema);
      expect(updated.schema.version).toBe('2.0.0');
    });

    it('should throw for non-existent schema', () => {
      expect(() => manager.updateSchema('no', createTestSchema())).toThrow('not found');
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata fields', () => {
      manager.create('test-1', 'Old Name', createTestSchema());
      const updated = manager.updateMetadata('test-1', {
        name: 'New Name',
        description: 'Updated desc',
        tags: ['new-tag'],
      });
      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('Updated desc');
      expect(updated.tags).toEqual(['new-tag']);
    });
  });

  describe('setStatus', () => {
    it('should transition draft -> testing', () => {
      manager.create('test-1', 'Test', createTestSchema());
      const updated = manager.setStatus('test-1', 'testing');
      expect(updated.status).toBe('testing');
    });

    it('should transition testing -> preview -> published', () => {
      manager.create('test-1', 'Test', createTestSchema());
      manager.setStatus('test-1', 'testing');
      manager.setStatus('test-1', 'preview');
      const published = manager.setStatus('test-1', 'published');
      expect(published.status).toBe('published');
    });

    it('should reject invalid transitions', () => {
      manager.create('test-1', 'Test', createTestSchema());
      expect(() => manager.setStatus('test-1', 'published')).toThrow('Invalid status transition');
    });
  });

  describe('delete', () => {
    it('should delete a draft schema', () => {
      manager.create('test-1', 'Test', createTestSchema());
      expect(manager.delete('test-1')).toBe(true);
      expect(manager.get('test-1')).toBeUndefined();
    });

    it('should return false for non-existent schema', () => {
      expect(manager.delete('nonexistent')).toBe(false);
    });

    it('should reject deletion of published schema', () => {
      manager.create('test-1', 'Test', createTestSchema());
      manager.setStatus('test-1', 'testing');
      manager.setStatus('test-1', 'preview');
      manager.setStatus('test-1', 'published');
      expect(() => manager.delete('test-1')).toThrow('Cannot delete published');
    });
  });

  describe('clone', () => {
    it('should clone a schema with new ID', () => {
      manager.create('original', 'Original', createTestSchema());
      const clone = manager.clone('original', 'copy', 'Copy of Original');
      expect(clone.id).toBe('copy');
      expect(clone.name).toBe('Copy of Original');
      expect(clone.status).toBe('draft');
      expect(clone.schema.version).toBe('1.0.0');
    });
  });

  describe('addVersionRecord', () => {
    it('should add a version record', () => {
      manager.create('test-1', 'Test', createTestSchema());
      manager.addVersionRecord('test-1', {
        version: 'abc123',
        publishedAt: new Date().toISOString(),
        changelog: 'Initial release',
        ossUrl: 'https://cdn.example.com/schemas/test-1/abc123.json',
      });
      const managed = manager.get('test-1')!;
      expect(managed.versions).toHaveLength(1);
      expect(managed.versions[0].version).toBe('abc123');
    });
  });

  describe('count', () => {
    it('should return correct count', () => {
      expect(manager.count()).toBe(0);
      manager.create('s1', 'S1', createTestSchema());
      manager.create('s2', 'S2', createTestSchema());
      expect(manager.count()).toBe(2);
    });
  });
});
