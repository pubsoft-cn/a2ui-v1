import { describe, it, expect } from 'vitest';
import { BindingEngine } from '../../src/core/BindingEngine';
import type { SchemaNode, DataContext } from '../../src/types';

describe('BindingEngine', () => {
  let engine: BindingEngine;

  beforeEach(() => {
    engine = new BindingEngine(false);
  });

  describe('resolveBindingPath', () => {
    it('should resolve simple paths', () => {
      const ctx: DataContext = { user: { name: 'Alice', age: 30 } };
      expect(engine.resolveBindingPath('user.name', ctx)).toBe('Alice');
      expect(engine.resolveBindingPath('user.age', ctx)).toBe(30);
    });

    it('should resolve array indices', () => {
      const ctx: DataContext = { items: ['a', 'b', 'c'] };
      expect(engine.resolveBindingPath('items[0]', ctx)).toBe('a');
      expect(engine.resolveBindingPath('items[2]', ctx)).toBe('c');
    });

    it('should resolve nested paths with arrays', () => {
      const ctx: DataContext = {
        list: [{ name: 'First' }, { name: 'Second' }],
      };
      expect(engine.resolveBindingPath('list[0].name', ctx)).toBe('First');
      expect(engine.resolveBindingPath('list[1].name', ctx)).toBe('Second');
    });

    it('should return undefined for missing paths', () => {
      const ctx: DataContext = { user: { name: 'Alice' } };
      expect(engine.resolveBindingPath('user.email', ctx)).toBeUndefined();
      expect(engine.resolveBindingPath('missing.path', ctx)).toBeUndefined();
    });

    it('should handle empty expression', () => {
      expect(engine.resolveBindingPath('', {})).toBeUndefined();
    });
  });

  describe('resolveValue', () => {
    const ctx: DataContext = {
      user: { name: 'Bob', verified: true },
      count: 42,
    };

    it('should resolve full binding expression preserving type', () => {
      expect(engine.resolveValue('{{count}}', ctx)).toBe(42);
      expect(engine.resolveValue('{{user.verified}}', ctx)).toBe(true);
      expect(engine.resolveValue('{{user.name}}', ctx)).toBe('Bob');
    });

    it('should interpolate mixed text + bindings as string', () => {
      expect(engine.resolveValue('Hello, {{user.name}}!', ctx)).toBe(
        'Hello, Bob!'
      );
      expect(
        engine.resolveValue('Count: {{count}} items', ctx)
      ).toBe('Count: 42 items');
    });

    it('should replace missing bindings with empty string', () => {
      expect(engine.resolveValue('{{missing}}', ctx)).toBeUndefined();
      expect(engine.resolveValue('Hi {{missing}}!', ctx)).toBe('Hi !');
    });

    it('should pass through non-string values', () => {
      expect(engine.resolveValue(42, ctx)).toBe(42);
      expect(engine.resolveValue(true, ctx)).toBe(true);
      expect(engine.resolveValue(null, ctx)).toBeNull();
    });

    it('should resolve arrays', () => {
      const result = engine.resolveValue(
        ['{{user.name}}', '{{count}}'],
        ctx
      );
      expect(result).toEqual(['Bob', 42]);
    });

    it('should resolve nested objects', () => {
      const result = engine.resolveValue(
        { label: '{{user.name}}', count: '{{count}}' },
        ctx
      );
      expect(result).toEqual({ label: 'Bob', count: 42 });
    });
  });

  describe('evaluateExpression', () => {
    const ctx: DataContext = {
      user: { name: 'Alice', active: true, role: 'admin' },
      count: 5,
      items: [1, 2, 3],
    };

    it('should evaluate truthy values', () => {
      expect(engine.evaluateExpression('user.active', ctx)).toBe(true);
      expect(engine.evaluateExpression('user.name', ctx)).toBe(true);
      expect(engine.evaluateExpression('count', ctx)).toBe(true);
    });

    it('should evaluate falsy values', () => {
      expect(engine.evaluateExpression('user.missing', ctx)).toBe(false);
    });

    it('should handle negation', () => {
      expect(engine.evaluateExpression('!user.active', ctx)).toBe(false);
      expect(engine.evaluateExpression('!user.missing', ctx)).toBe(true);
    });

    it('should handle equality comparison', () => {
      expect(
        engine.evaluateExpression("user.role === 'admin'", ctx)
      ).toBe(true);
      expect(
        engine.evaluateExpression("user.role === 'user'", ctx)
      ).toBe(false);
    });

    it('should handle inequality comparison', () => {
      expect(
        engine.evaluateExpression("user.role !== 'user'", ctx)
      ).toBe(true);
    });

    it('should handle numeric comparison', () => {
      expect(engine.evaluateExpression('count > 3', ctx)).toBe(true);
      expect(engine.evaluateExpression('count < 3', ctx)).toBe(false);
      expect(engine.evaluateExpression('count >= 5', ctx)).toBe(true);
      expect(engine.evaluateExpression('count <= 5', ctx)).toBe(true);
    });

    it('should handle {{expr}} wrapper', () => {
      expect(engine.evaluateExpression('{{user.active}}', ctx)).toBe(
        true
      );
      expect(
        engine.evaluateExpression("{{user.role === 'admin'}}", ctx)
      ).toBe(true);
    });

    it('should handle boolean literals in comparison', () => {
      expect(
        engine.evaluateExpression('user.active === true', ctx)
      ).toBe(true);
    });
  });

  describe('resolve (full tree)', () => {
    it('should resolve a simple tree', () => {
      const root: SchemaNode = {
        id: 'root',
        type: 'view',
        props: {},
        children: [
          {
            id: 'greeting',
            type: 'text',
            props: { content: 'Hello, {{user.name}}!' },
          },
        ],
      };

      const ctx: DataContext = { user: { name: 'Charlie' } };
      const result = engine.resolve(root, ctx);

      expect(result).not.toBeNull();
      expect(result!.children).toHaveLength(1);
      expect(result!.children![0].props['content']).toBe(
        'Hello, Charlie!'
      );
    });

    it('should handle conditional rendering', () => {
      const root: SchemaNode = {
        id: 'root',
        type: 'view',
        props: {},
        children: [
          {
            id: 'visible',
            type: 'text',
            props: { content: 'Visible' },
            condition: 'showText',
          },
          {
            id: 'hidden',
            type: 'text',
            props: { content: 'Hidden' },
            condition: 'hideText',
          },
        ],
      };

      const ctx: DataContext = { showText: true, hideText: false };
      const result = engine.resolve(root, ctx);

      expect(result!.children).toHaveLength(1);
      expect(result!.children![0].id).toBe('visible');
    });

    it('should handle list repetition', () => {
      const root: SchemaNode = {
        id: 'root',
        type: 'view',
        props: {},
        children: [
          {
            id: 'item',
            type: 'text',
            props: { content: '{{item.name}}' },
            repeat: 'users',
            repeatItem: 'item',
            repeatIndex: 'idx',
          },
        ],
      };

      const ctx: DataContext = {
        users: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
      };

      const result = engine.resolve(root, ctx);

      expect(result!.children).toHaveLength(3);
      expect(result!.children![0].id).toBe('item_0');
      expect(result!.children![0].props['content']).toBe('Alice');
      expect(result!.children![1].props['content']).toBe('Bob');
      expect(result!.children![2].props['content']).toBe('Charlie');
    });

    it('should handle nested repeat with index', () => {
      const root: SchemaNode = {
        id: 'root',
        type: 'view',
        props: {},
        children: [
          {
            id: 'item',
            type: 'text',
            props: { content: '{{idx}}: {{item}}' },
            repeat: 'items',
            repeatItem: 'item',
            repeatIndex: 'idx',
          },
        ],
      };

      const ctx: DataContext = { items: ['a', 'b', 'c'] };
      const result = engine.resolve(root, ctx);

      expect(result!.children![0].props['content']).toBe('0: a');
      expect(result!.children![1].props['content']).toBe('1: b');
    });

    it('should handle conditional root node', () => {
      const root: SchemaNode = {
        id: 'root',
        type: 'view',
        props: {},
        condition: 'showPage',
      };

      const ctx: DataContext = { showPage: false };
      const result = engine.resolve(root, ctx);

      expect(result).toBeNull();
    });

    it('should resolve styles', () => {
      const root: SchemaNode = {
        id: 'root',
        type: 'view',
        props: {},
        style: { color: '{{theme.primary}}', fontSize: 14 },
      };

      const ctx: DataContext = { theme: { primary: '#ff0000' } };
      const result = engine.resolve(root, ctx);

      expect(result!.style).toEqual({ color: '#ff0000', fontSize: 14 });
    });

    it('should preserve events in resolved tree', () => {
      const root: SchemaNode = {
        id: 'btn',
        type: 'button',
        props: { text: 'Click me' },
        events: [
          {
            type: 'tap',
            action: {
              type: 'navigate',
              payload: { url: '/detail' },
            },
          },
        ],
      };

      const result = engine.resolve(root, {});
      expect(result!.events).toHaveLength(1);
      expect(result!.events![0].type).toBe('tap');
    });

    it('should handle repeat with non-array gracefully', () => {
      const root: SchemaNode = {
        id: 'root',
        type: 'view',
        props: {},
        children: [
          {
            id: 'item',
            type: 'text',
            props: { content: '{{item}}' },
            repeat: 'notAnArray',
          },
        ],
      };

      const ctx: DataContext = { notAnArray: 'string' };
      const result = engine.resolve(root, ctx);

      // Non-array repeat source should produce no children
      expect(result!.children).toBeUndefined();
    });
  });
});
