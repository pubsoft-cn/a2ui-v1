/**
 * SchemaDesigner Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaDesigner } from '../../src/management/SchemaDesigner';

describe('SchemaDesigner', () => {
  let designer: SchemaDesigner;

  beforeEach(() => {
    designer = new SchemaDesigner();
  });

  describe('createEmptySchema', () => {
    it('should create an empty schema with defaults', () => {
      const schema = designer.createEmptySchema();
      expect(schema.version).toBeTruthy();
      expect(schema.meta.title).toBe('Untitled Page');
      expect(schema.root.type).toBe('view');
      expect(schema.dataSources).toEqual([]);
    });

    it('should accept custom meta', () => {
      const schema = designer.createEmptySchema({
        title: 'My Page',
        backgroundColor: '#f0f0f0',
      });
      expect(schema.meta.title).toBe('My Page');
      expect(schema.meta.backgroundColor).toBe('#f0f0f0');
    });
  });

  describe('createFromTemplate', () => {
    it('should create schema from blank template', () => {
      const schema = designer.createFromTemplate('blank');
      expect(schema).not.toBeNull();
      expect(schema!.root.type).toBe('view');
    });

    it('should create schema from list-page template', () => {
      const schema = designer.createFromTemplate('list-page');
      expect(schema).not.toBeNull();
      expect(schema!.root.type).toBe('scroll-view');
      expect(schema!.dataSources).toHaveLength(1);
    });

    it('should create schema from detail-page template', () => {
      const schema = designer.createFromTemplate('detail-page');
      expect(schema).not.toBeNull();
      expect(schema!.root.children).toHaveLength(3);
    });

    it('should create schema from form-page template', () => {
      const schema = designer.createFromTemplate('form-page');
      expect(schema).not.toBeNull();
      expect(schema!.root.type).toBe('form');
    });

    it('should return null for unknown template', () => {
      expect(designer.createFromTemplate('nonexistent')).toBeNull();
    });
  });

  describe('createNode', () => {
    it('should create a node with unique ID', () => {
      const node1 = designer.createNode('text', { content: 'Hello' });
      const node2 = designer.createNode('button', { text: 'Click' });
      expect(node1.id).not.toBe(node2.id);
      expect(node1.type).toBe('text');
      expect(node1.props.content).toBe('Hello');
    });

    it('should accept optional style and events', () => {
      const node = designer.createNode('view', {}, {
        style: { padding: 16 },
        condition: '{{showHeader}}',
      });
      expect(node.style).toEqual({ padding: 16 });
      expect(node.condition).toBe('{{showHeader}}');
    });
  });

  describe('addChild / removeChild', () => {
    it('should add children to a parent', () => {
      const parent = designer.createNode('view');
      const child = designer.createNode('text', { content: 'child' });
      designer.addChild(parent, child);
      expect(parent.children).toHaveLength(1);
      expect(parent.children![0].id).toBe(child.id);
    });

    it('should remove a child by ID', () => {
      const parent = designer.createNode('view');
      const child = designer.createNode('text');
      designer.addChild(parent, child);
      expect(designer.removeChild(parent, child.id)).toBe(true);
      expect(parent.children).toHaveLength(0);
    });

    it('should return false when removing non-existent child', () => {
      const parent = designer.createNode('view');
      expect(designer.removeChild(parent, 'nonexistent')).toBe(false);
    });
  });

  describe('findNode', () => {
    it('should find a node by ID in tree', () => {
      const root = designer.createNode('view');
      const child = designer.createNode('text', { content: 'Found' });
      designer.addChild(root, child);
      const found = designer.findNode(root, child.id);
      expect(found).not.toBeNull();
      expect(found!.props.content).toBe('Found');
    });

    it('should return null for non-existent ID', () => {
      const root = designer.createNode('view');
      expect(designer.findNode(root, 'nonexistent')).toBeNull();
    });
  });

  describe('addDataSource', () => {
    it('should add a data source to schema', () => {
      const schema = designer.createEmptySchema();
      designer.addDataSource(schema, {
        key: 'users',
        api: '/api/users',
        method: 'GET',
      });
      expect(schema.dataSources).toHaveLength(1);
      expect(schema.dataSources![0].key).toBe('users');
    });
  });

  describe('validate', () => {
    it('should validate a correct schema', () => {
      const schema = designer.createEmptySchema();
      const result = designer.validate(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing version', () => {
      const schema = designer.createEmptySchema();
      schema.version = '';
      const result = designer.validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('version'))).toBe(true);
    });

    it('should detect duplicate node IDs', () => {
      const schema = designer.createEmptySchema();
      const child1 = { id: 'dup', type: 'text' as const, props: {} };
      const child2 = { id: 'dup', type: 'text' as const, props: {} };
      schema.root.children = [child1, child2];
      const result = designer.validate(schema);
      expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
    });

    it('should detect duplicate data source keys', () => {
      const schema = designer.createEmptySchema();
      schema.dataSources = [
        { key: 'data', api: '/api/1', method: 'GET' },
        { key: 'data', api: '/api/2', method: 'GET' },
      ];
      const result = designer.validate(schema);
      expect(result.errors.some((e) => e.message.includes('Duplicate data source'))).toBe(true);
    });

    it('should warn about deep nesting', () => {
      const schema = designer.createEmptySchema();
      let current = schema.root;
      for (let i = 0; i < 12; i++) {
        const child = { id: `deep_${i}`, type: 'view' as const, props: {} };
        current.children = [child];
        current = child;
      }
      const result = designer.validate(schema);
      expect(result.warnings.some((w) => w.message.includes('Deep nesting'))).toBe(true);
    });
  });

  describe('getTemplates', () => {
    it('should return built-in templates', () => {
      const templates = designer.getTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(4);
      expect(templates.some((t) => t.id === 'blank')).toBe(true);
      expect(templates.some((t) => t.id === 'list-page')).toBe(true);
    });
  });

  describe('countNodes', () => {
    it('should count all nodes in a tree', () => {
      const root = designer.createNode('view');
      const c1 = designer.createNode('text');
      const c2 = designer.createNode('button');
      designer.addChild(root, c1);
      designer.addChild(root, c2);
      expect(designer.countNodes(root)).toBe(3);
    });
  });

  describe('collectBindings', () => {
    it('should collect binding expressions from tree', () => {
      const root = designer.createNode('view');
      const child = designer.createNode('text', { content: '{{user.name}}' });
      child.condition = '{{isLoggedIn}}';
      designer.addChild(root, child);
      const bindings = designer.collectBindings(root);
      expect(bindings).toContain('{{user.name}}');
      expect(bindings).toContain('{{isLoggedIn}}');
    });
  });
});
