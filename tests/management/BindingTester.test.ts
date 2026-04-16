/**
 * BindingTester Tests
 */

import { describe, it, expect } from 'vitest';
import { BindingTester } from '../../src/management/BindingTester';
import type { SchemaDocument, DataContext } from '../../src/types';

const createTestSchema = (): SchemaDocument => ({
  version: '1.0.0',
  meta: { title: 'Test' },
  root: {
    id: 'root',
    type: 'view',
    props: {},
    children: [
      { id: 'name', type: 'text', props: { content: '{{user.name}}' } },
      { id: 'age', type: 'text', props: { content: '年龄: {{user.age}}' } },
      { id: 'avatar', type: 'image', props: { src: '{{user.avatar}}' } },
    ],
  },
});

describe('BindingTester', () => {
  const tester = new BindingTester();

  describe('runTest', () => {
    it('should pass when all bindings resolve', () => {
      const result = tester.runTest(createTestSchema(), {
        name: 'All bindings resolve',
        inputData: {
          user: { name: 'Alice', age: 25, avatar: 'https://example.com/alice.png' },
        },
      });

      expect(result.testName).toBe('All bindings resolve');
      expect(result.passed).toBe(true);
      expect(result.totalBindings).toBeGreaterThan(0);
      expect(result.unresolvedBindings).toHaveLength(0);
    });

    it('should detect unresolved bindings', () => {
      const result = tester.runTest(createTestSchema(), {
        name: 'Missing data test',
        inputData: {
          user: { name: 'Alice' },
          // age and avatar missing
        },
      });

      expect(result.unresolvedBindings.length).toBeGreaterThan(0);
    });

    it('should run assertions against expected results', () => {
      const result = tester.runTest(createTestSchema(), {
        name: 'With assertions',
        inputData: {
          user: { name: 'Bob', age: 30, avatar: 'https://example.com/bob.png' },
        },
        expectedResults: {
          name: { content: 'Bob' },
          avatar: { src: 'https://example.com/bob.png' },
        },
      });

      expect(result.assertions).toHaveLength(2);
      expect(result.assertions.every((a) => a.passed)).toBe(true);
    });

    it('should detect assertion failures', () => {
      const result = tester.runTest(createTestSchema(), {
        name: 'Wrong assertion',
        inputData: {
          user: { name: 'Charlie', age: 20, avatar: 'https://example.com/charlie.png' },
        },
        expectedResults: {
          name: { content: 'Wrong Name' },
        },
      });

      expect(result.assertions.some((a) => !a.passed)).toBe(true);
    });

    it('should report duration', () => {
      const result = tester.runTest(createTestSchema(), {
        name: 'Duration test',
        inputData: { user: { name: 'Test', age: 1, avatar: 'x' } },
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('runTests', () => {
    it('should run multiple test cases', () => {
      const results = tester.runTests(createTestSchema(), [
        {
          name: 'Test 1',
          inputData: { user: { name: 'A', age: 1, avatar: 'x' } },
        },
        {
          name: 'Test 2',
          inputData: { user: { name: 'B', age: 2, avatar: 'y' } },
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].testName).toBe('Test 1');
      expect(results[1].testName).toBe('Test 2');
    });
  });

  describe('resolveExpression', () => {
    it('should resolve a single binding expression', () => {
      const value = tester.resolveExpression('{{user.name}}', {
        user: { name: 'David' },
      });
      expect(value).toBe('David');
    });

    it('should return undefined for missing path', () => {
      const value = tester.resolveExpression('{{missing.path}}', {});
      expect(value).toBeUndefined();
    });
  });

  describe('checkAllBindings', () => {
    it('should report all bindings resolved', () => {
      const result = tester.checkAllBindings(createTestSchema(), {
        user: { name: 'Eve', age: 28, avatar: 'https://example.com/eve.png' },
      });

      expect(result.total).toBeGreaterThan(0);
      expect(result.resolved).toBe(result.total);
      expect(result.unresolved).toHaveLength(0);
    });

    it('should report unresolved bindings', () => {
      const result = tester.checkAllBindings(createTestSchema(), {});

      expect(result.unresolved.length).toBeGreaterThan(0);
    });
  });
});
