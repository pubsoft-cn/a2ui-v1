import { describe, it, expect } from 'vitest';
import { BuildParams, type BuildParamsContext } from '../../src/core/BuildParams';

describe('BuildParams', () => {
  describe('resolvePath', () => {
    it('should resolve formData paths', () => {
      const ctx: BuildParamsContext = {
        formData: { username: 'Alice', age: 30 },
      };

      expect(BuildParams.resolvePath('formData.username', ctx)).toBe('Alice');
      expect(BuildParams.resolvePath('formData.age', ctx)).toBe(30);
    });

    it('should resolve context.row paths', () => {
      const ctx: BuildParamsContext = {
        row: { id: 42, name: 'Order-1' },
      };

      expect(BuildParams.resolvePath('context.row.id', { context: ctx })).toBe(42);
      expect(BuildParams.resolvePath('context.row.name', { context: ctx })).toBe('Order-1');
    });

    it('should resolve nested paths', () => {
      const ctx: BuildParamsContext = {
        formData: { address: { city: 'Shanghai', zip: '200000' } },
      };

      expect(BuildParams.resolvePath('formData.address.city', ctx)).toBe('Shanghai');
      expect(BuildParams.resolvePath('formData.address.zip', ctx)).toBe('200000');
    });

    it('should resolve array indices', () => {
      const ctx: BuildParamsContext = {
        formData: { tags: ['a', 'b', 'c'] },
      };

      expect(BuildParams.resolvePath('formData.tags[0]', ctx)).toBe('a');
      expect(BuildParams.resolvePath('formData.tags[2]', ctx)).toBe('c');
    });

    it('should return undefined for missing paths', () => {
      const ctx: BuildParamsContext = { formData: { name: 'Alice' } };

      expect(BuildParams.resolvePath('formData.missing', ctx)).toBeUndefined();
      expect(BuildParams.resolvePath('nonexistent.path', ctx)).toBeUndefined();
    });

    it('should handle empty expression', () => {
      expect(BuildParams.resolvePath('', {})).toBeUndefined();
    });

    it('should resolve shorthand paths', () => {
      const ctx: BuildParamsContext = { userId: 42 };
      expect(BuildParams.resolvePath('userId', ctx)).toBe(42);
    });
  });

  describe('resolveString', () => {
    it('should resolve single template expression preserving type', () => {
      const ctx: BuildParamsContext = {
        formData: { count: 42, active: true },
      };

      expect(BuildParams.resolveString('${formData.count}', ctx)).toBe(42);
      expect(BuildParams.resolveString('${formData.active}', ctx)).toBe(true);
    });

    it('should interpolate mixed text + templates as string', () => {
      const ctx: BuildParamsContext = {
        formData: { name: 'Alice' },
        row: { id: 1 },
      };

      expect(
        BuildParams.resolveString('User: ${formData.name}', ctx)
      ).toBe('User: Alice');
    });

    it('should handle multiple templates in one string', () => {
      const ctx: BuildParamsContext = {
        formData: { first: 'John', last: 'Doe' },
      };

      expect(
        BuildParams.resolveString('${formData.first} ${formData.last}', ctx)
      ).toBe('John Doe');
    });

    it('should replace missing values with empty string in mixed mode', () => {
      const ctx: BuildParamsContext = {};
      expect(BuildParams.resolveString('Hello ${formData.name}!', ctx)).toBe('Hello !');
    });

    it('should return undefined for missing single expression', () => {
      const ctx: BuildParamsContext = {};
      expect(BuildParams.resolveString('${formData.missing}', ctx)).toBeUndefined();
    });

    it('should pass through plain strings', () => {
      expect(BuildParams.resolveString('plain text', {})).toBe('plain text');
    });
  });

  describe('resolveValue', () => {
    const ctx: BuildParamsContext = {
      formData: { name: 'Bob', count: 5 },
      row: { id: 99 },
    };

    it('should resolve string templates', () => {
      expect(BuildParams.resolveValue('${formData.name}', ctx)).toBe('Bob');
    });

    it('should resolve arrays of templates', () => {
      const result = BuildParams.resolveValue(
        ['${formData.name}', '${formData.count}'],
        ctx
      );
      expect(result).toEqual(['Bob', 5]);
    });

    it('should resolve nested object templates', () => {
      const result = BuildParams.resolveValue(
        { user: '${formData.name}', rowId: '${row.id}' },
        ctx
      );
      expect(result).toEqual({ user: 'Bob', rowId: 99 });
    });

    it('should pass through primitives', () => {
      expect(BuildParams.resolveValue(42, ctx)).toBe(42);
      expect(BuildParams.resolveValue(true, ctx)).toBe(true);
      expect(BuildParams.resolveValue(null, ctx)).toBeNull();
    });
  });

  describe('resolve (full params)', () => {
    it('should resolve a full params template with formData', () => {
      const template = {
        userId: '${formData.userId}',
        action: 'update',
        data: {
          name: '${formData.name}',
          email: '${formData.email}',
        },
      };

      const ctx: BuildParamsContext = {
        formData: {
          userId: 123,
          name: 'Alice',
          email: 'alice@example.com',
        },
      };

      const result = BuildParams.resolve(template, ctx);
      expect(result).toEqual({
        userId: 123,
        action: 'update',
        data: {
          name: 'Alice',
          email: 'alice@example.com',
        },
      });
    });

    it('should resolve a full params template with context.row', () => {
      const template = {
        orderId: '${context.row.id}',
        status: '${context.row.status}',
        operator: '${formData.operatorId}',
      };

      const ctx: BuildParamsContext = {
        context: {
          row: { id: 'ORD-001', status: 'pending' },
        },
        formData: { operatorId: 'OP-42' },
      };

      const result = BuildParams.resolve(template, ctx);
      expect(result).toEqual({
        orderId: 'ORD-001',
        status: 'pending',
        operator: 'OP-42',
      });
    });

    it('should handle mixed static and dynamic values', () => {
      const template = {
        type: 'order',
        id: '${context.row.id}',
        page: 1,
        active: true,
      };

      const ctx: BuildParamsContext = {
        context: { row: { id: 555 } },
      };

      const result = BuildParams.resolve(template, ctx);
      expect(result).toEqual({
        type: 'order',
        id: 555,
        page: 1,
        active: true,
      });
    });

    it('should handle empty template', () => {
      expect(BuildParams.resolve({}, {})).toEqual({});
    });
  });
});
