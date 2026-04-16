/**
 * MockTestRunner Tests
 */

import { describe, it, expect } from 'vitest';
import { MockTestRunner } from '../../src/management/MockTestRunner';
import type { SchemaDocument } from '../../src/types';
import type { MockTestScenario } from '../../src/management/types';

const createTestSchema = (): SchemaDocument => ({
  version: '1.0.0',
  meta: { title: 'Test Page' },
  root: {
    id: 'root',
    type: 'view',
    props: {},
    children: [
      { id: 'header', type: 'text', props: { content: '{{info.title}}' } },
      {
        id: 'list-item',
        type: 'view',
        props: {},
        repeat: '{{items}}',
        repeatItem: 'item',
        children: [
          { id: 'item-title', type: 'text', props: { content: '{{item.name}}' } },
        ],
      },
      { id: 'btn', type: 'button', props: { text: 'Submit' } },
    ],
  },
  dataSources: [
    { key: 'info', api: '/api/info', method: 'GET' },
    { key: 'items', api: '/api/items', method: 'GET' },
  ],
});

describe('MockTestRunner', () => {
  const runner = new MockTestRunner();

  describe('runScenario', () => {
    it('should pass with valid mock data', () => {
      const scenario: MockTestScenario = {
        name: 'Happy path',
        mockDataSources: [
          { key: 'info', data: { title: 'Welcome' } },
          {
            key: 'items',
            data: [
              { name: 'Item 1' },
              { name: 'Item 2' },
            ],
          },
        ],
      };

      const result = runner.runScenario(createTestSchema(), scenario);
      expect(result.passed).toBe(true);
      expect(result.scenarioName).toBe('Happy path');
      expect(result.nodeCount).toBeGreaterThan(0);
      expect(result.componentTypes).toContain('view');
      expect(result.componentTypes).toContain('text');
      expect(result.componentTypes).toContain('button');
    });

    it('should validate expected node count', () => {
      const scenario: MockTestScenario = {
        name: 'Node count check',
        mockDataSources: [
          { key: 'info', data: { title: 'Test' } },
          { key: 'items', data: [{ name: 'A' }] },
        ],
        expectedNodeCount: 999, // intentionally wrong
      };

      const result = runner.runScenario(createTestSchema(), scenario);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('Expected 999 nodes'))).toBe(true);
    });

    it('should validate expected component types', () => {
      const scenario: MockTestScenario = {
        name: 'Type check',
        mockDataSources: [
          { key: 'info', data: { title: 'Test' } },
          { key: 'items', data: [] },
        ],
        expectedTypes: ['image'], // no image in schema
      };

      const result = runner.runScenario(createTestSchema(), scenario);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('image'))).toBe(true);
    });

    it('should handle simulated errors in mock data', () => {
      const scenario: MockTestScenario = {
        name: 'Error simulation',
        mockDataSources: [
          { key: 'info', data: null, simulateError: true, errorMessage: 'Network error' },
          { key: 'items', data: [] },
        ],
      };

      const result = runner.runScenario(createTestSchema(), scenario);
      // Should still render, just with null data
      expect(result.nodeCount).toBeGreaterThan(0);
    });

    it('should inject route params', () => {
      const scenario: MockTestScenario = {
        name: 'With route params',
        mockDataSources: [
          { key: 'info', data: { title: 'Routed' } },
          { key: 'items', data: [] },
        ],
        routeParams: { id: '42' },
      };

      const result = runner.runScenario(createTestSchema(), scenario);
      expect(result.passed).toBe(true);
    });

    it('should report duration', () => {
      const result = runner.runScenario(createTestSchema(), {
        name: 'Duration',
        mockDataSources: [
          { key: 'info', data: { title: 'T' } },
          { key: 'items', data: [] },
        ],
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('runScenarios', () => {
    it('should run multiple scenarios', () => {
      const results = runner.runScenarios(createTestSchema(), [
        {
          name: 'S1',
          mockDataSources: [
            { key: 'info', data: { title: 'A' } },
            { key: 'items', data: [] },
          ],
        },
        {
          name: 'S2',
          mockDataSources: [
            { key: 'info', data: { title: 'B' } },
            { key: 'items', data: [{ name: 'X' }] },
          ],
        },
      ]);

      expect(results).toHaveLength(2);
    });
  });

  describe('generateDefaultMockData', () => {
    it('should generate mock data for data sources', () => {
      const mockData = runner.generateDefaultMockData(createTestSchema());
      expect(mockData).toHaveLength(2);
      expect(mockData[0].key).toBe('info');
      expect(mockData[1].key).toBe('items');
    });

    it('should return empty for schema without data sources', () => {
      const schema = createTestSchema();
      schema.dataSources = undefined;
      expect(runner.generateDefaultMockData(schema)).toEqual([]);
    });
  });
});
