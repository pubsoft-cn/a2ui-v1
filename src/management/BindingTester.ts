/**
 * BindingTester - Test Binding Expressions
 *
 * Validates that binding expressions in a schema resolve correctly
 * with provided test data. Reports unresolved bindings and assertion failures.
 */

import { BindingEngine } from '../core/BindingEngine';
import type { SchemaDocument, SchemaNode, DataContext, RenderNode } from '../types';
import type {
  BindingTestCase,
  BindingTestResult,
  UnresolvedBinding,
  BindingAssertion,
} from './types';

export class BindingTester {
  private bindingEngine: BindingEngine;

  constructor() {
    this.bindingEngine = new BindingEngine(false);
  }

  /**
   * Run a binding test case against a schema.
   */
  runTest(
    schema: SchemaDocument,
    testCase: BindingTestCase
  ): BindingTestResult {
    const startTime = Date.now();

    // Resolve bindings
    const renderTree = this.bindingEngine.resolve(
      schema.root,
      testCase.inputData
    );

    // Collect binding stats
    const allBindings = this.collectAllBindings(schema.root);
    const unresolvedBindings: UnresolvedBinding[] = [];

    if (renderTree) {
      this.findUnresolvedBindings(
        schema.root,
        renderTree,
        testCase.inputData,
        unresolvedBindings
      );
    }

    // Run assertions if provided
    const assertions: BindingAssertion[] = [];
    if (testCase.expectedResults && renderTree) {
      this.runAssertions(
        renderTree,
        testCase.expectedResults,
        assertions
      );
    }

    const allAssertionsPassed = assertions.every((a) => a.passed);
    const duration = Date.now() - startTime;

    return {
      testName: testCase.name,
      passed:
        unresolvedBindings.length === 0 && allAssertionsPassed,
      totalBindings: allBindings.length,
      resolvedBindings:
        allBindings.length - unresolvedBindings.length,
      unresolvedBindings,
      assertions,
      duration,
    };
  }

  /**
   * Run multiple test cases and return all results.
   */
  runTests(
    schema: SchemaDocument,
    testCases: BindingTestCase[]
  ): BindingTestResult[] {
    return testCases.map((tc) => this.runTest(schema, tc));
  }

  /**
   * Quick check: resolve a single binding expression against data.
   */
  resolveExpression(
    expression: string,
    data: DataContext
  ): unknown {
    return this.bindingEngine.resolveValue(expression, data);
  }

  /**
   * Check if all binding expressions in a schema can be resolved with given data.
   */
  checkAllBindings(
    schema: SchemaDocument,
    data: DataContext
  ): { resolved: number; unresolved: string[]; total: number } {
    const bindings = this.collectAllBindings(schema.root);
    const unresolved: string[] = [];

    for (const binding of bindings) {
      const value = this.bindingEngine.resolveValue(binding, data);
      if (value === undefined || value === null || value === '') {
        unresolved.push(binding);
      }
    }

    return {
      resolved: bindings.length - unresolved.length,
      unresolved,
      total: bindings.length,
    };
  }

  /**
   * Collect all binding expressions from a schema node tree.
   */
  private collectAllBindings(node: SchemaNode): string[] {
    const bindings: string[] = [];
    this.collectBindingsRecursive(node, bindings);
    return bindings;
  }

  private collectBindingsRecursive(
    node: SchemaNode,
    bindings: string[]
  ): void {
    const bindingRegex = /\{\{[^{}]+\}\}/g;

    for (const value of Object.values(node.props)) {
      if (typeof value === 'string') {
        const matches = value.match(bindingRegex);
        if (matches) bindings.push(...matches);
      }
    }

    if (node.condition && node.condition.includes('{{')) {
      bindings.push(node.condition);
    }

    if (node.repeat && node.repeat.includes('{{')) {
      bindings.push(node.repeat);
    }

    if (node.children) {
      for (const child of node.children) {
        this.collectBindingsRecursive(child, bindings);
      }
    }
  }

  /**
   * Compare schema node props with render node props to find unresolved bindings.
   */
  private findUnresolvedBindings(
    schemaNode: SchemaNode,
    renderNode: RenderNode,
    data: DataContext,
    results: UnresolvedBinding[]
  ): void {
    const bindingRegex = /\{\{[^{}]+\}\}/g;

    for (const [key, value] of Object.entries(schemaNode.props)) {
      if (typeof value === 'string' && bindingRegex.test(value)) {
        const resolved = renderNode.props[key];
        if (
          resolved === undefined ||
          resolved === null ||
          resolved === ''
        ) {
          results.push({
            nodeId: schemaNode.id,
            prop: key,
            expression: value,
            resolvedValue: resolved,
          });
        }
      }
    }

    // Check children
    if (schemaNode.children && renderNode.children) {
      const renderMap = new Map<string, RenderNode>();
      for (const child of renderNode.children) {
        renderMap.set(child.id, child);
      }

      for (const schemaChild of schemaNode.children) {
        if (!schemaChild.repeat) {
          const renderChild = renderMap.get(schemaChild.id);
          if (renderChild) {
            this.findUnresolvedBindings(
              schemaChild,
              renderChild,
              data,
              results
            );
          }
        }
      }
    }
  }

  /**
   * Run assertions against the render tree.
   */
  private runAssertions(
    renderTree: RenderNode,
    expectedResults: Record<string, Record<string, unknown>>,
    results: BindingAssertion[]
  ): void {
    for (const [nodeId, expectedProps] of Object.entries(
      expectedResults
    )) {
      const node = this.findRenderNode(renderTree, nodeId);

      for (const [prop, expected] of Object.entries(expectedProps)) {
        const actual = node?.props[prop];
        results.push({
          nodeId,
          prop,
          expected,
          actual,
          passed: this.deepEqual(actual, expected),
        });
      }
    }
  }

  /**
   * Find a render node by ID.
   */
  private findRenderNode(
    tree: RenderNode,
    nodeId: string
  ): RenderNode | null {
    if (tree.id === nodeId) return tree;
    if (tree.children) {
      for (const child of tree.children) {
        const found = this.findRenderNode(child, nodeId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Simple deep equality check.
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const aKeys = Object.keys(a as Record<string, unknown>);
      const bKeys = Object.keys(b as Record<string, unknown>);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every((key) =>
        this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
    }

    return false;
  }
}
