/**
 * MockTestRunner - Mock Data Testing for Schemas
 *
 * Runs schema through the full render pipeline with mock data sources,
 * verifying the output structure and component types.
 */

import { BindingEngine } from '../core/BindingEngine';
import { Renderer, type ComponentRenderOutput } from '../core/Renderer';
import type { SchemaDocument, DataContext, RenderNode } from '../types';
import type { MockTestScenario, MockTestResult, MockDataSource } from './types';

export class MockTestRunner {
  private bindingEngine: BindingEngine;
  private renderer: Renderer;

  constructor() {
    this.bindingEngine = new BindingEngine(false);
    this.renderer = new Renderer(false);
  }

  /**
   * Run a single mock test scenario.
   */
  runScenario(
    schema: SchemaDocument,
    scenario: MockTestScenario
  ): MockTestResult {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Build mock data context
      const data = this.buildMockContext(scenario.mockDataSources);

      // Inject route params
      if (scenario.routeParams) {
        data['$route'] = scenario.routeParams;
      }

      // Bind
      const renderTree = this.bindingEngine.resolve(schema.root, data);

      if (!renderTree) {
        return {
          scenarioName: scenario.name,
          passed: false,
          nodeCount: 0,
          componentTypes: [],
          errors: ['Root node resolved to null'],
          duration: Date.now() - startTime,
        };
      }

      // Render
      const output = this.renderer.render(renderTree);

      if (!output) {
        return {
          scenarioName: scenario.name,
          passed: false,
          nodeCount: 0,
          componentTypes: [],
          errors: ['Renderer produced null output'],
          renderTree,
          duration: Date.now() - startTime,
        };
      }

      // Collect stats
      const nodeCount = this.countNodes(output);
      const componentTypes = this.collectTypes(output);

      // Validate expectations
      if (
        scenario.expectedNodeCount !== undefined &&
        nodeCount !== scenario.expectedNodeCount
      ) {
        errors.push(
          `Expected ${scenario.expectedNodeCount} nodes, got ${nodeCount}`
        );
      }

      if (scenario.expectedTypes) {
        for (const expectedType of scenario.expectedTypes) {
          if (!componentTypes.includes(expectedType)) {
            errors.push(
              `Expected component type "${expectedType}" not found in output`
            );
          }
        }
      }

      return {
        scenarioName: scenario.name,
        passed: errors.length === 0,
        nodeCount,
        componentTypes,
        errors,
        renderTree,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        scenarioName: scenario.name,
        passed: false,
        nodeCount: 0,
        componentTypes: [],
        errors: [
          error instanceof Error ? error.message : String(error),
        ],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run multiple test scenarios.
   */
  runScenarios(
    schema: SchemaDocument,
    scenarios: MockTestScenario[]
  ): MockTestResult[] {
    return scenarios.map((s) => this.runScenario(schema, s));
  }

  /**
   * Generate a default mock data context from schema data source declarations.
   */
  generateDefaultMockData(
    schema: SchemaDocument
  ): MockDataSource[] {
    if (!schema.dataSources) return [];

    return schema.dataSources.map((ds) => ({
      key: ds.key,
      data: this.generateMockValue(ds.key),
    }));
  }

  /**
   * Build a data context from mock data sources.
   */
  private buildMockContext(
    mockSources: MockDataSource[]
  ): DataContext {
    const context: DataContext = {};

    for (const source of mockSources) {
      if (source.simulateError) {
        context[source.key] = null;
      } else {
        context[source.key] = source.data;
      }
    }

    return context;
  }

  /**
   * Count nodes in a component output tree.
   */
  private countNodes(output: ComponentRenderOutput): number {
    let count = 1;
    if (output.children) {
      for (const child of output.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  /**
   * Collect all unique component types in output tree.
   */
  private collectTypes(output: ComponentRenderOutput): string[] {
    const types = new Set<string>();
    this.collectTypesRecursive(output, types);
    return Array.from(types);
  }

  private collectTypesRecursive(
    output: ComponentRenderOutput,
    types: Set<string>
  ): void {
    types.add(output.type);
    if (output.children) {
      for (const child of output.children) {
        this.collectTypesRecursive(child, types);
      }
    }
  }

  /**
   * Generate a simple mock value for a data source key.
   */
  private generateMockValue(key: string): unknown {
    // Generate reasonable mock data based on common key patterns
    if (key.includes('list') || key.includes('items')) {
      return [
        { id: 1, title: 'Mock Item 1', description: 'Description 1' },
        { id: 2, title: 'Mock Item 2', description: 'Description 2' },
        { id: 3, title: 'Mock Item 3', description: 'Description 3' },
      ];
    }

    if (key.includes('detail') || key.includes('info')) {
      return {
        id: 1,
        title: 'Mock Title',
        content: 'Mock content text',
        image: 'https://example.com/mock.png',
      };
    }

    if (key.includes('user') || key.includes('profile')) {
      return {
        id: 1,
        name: 'Mock User',
        avatar: 'https://example.com/avatar.png',
      };
    }

    return { mockData: true, key };
  }
}
