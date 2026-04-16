/**
 * BindingEngine - Schema + Data Merger
 *
 * Takes a SchemaDocument (the "blueprint") and a DataContext (the "data"),
 * evaluates binding expressions like "{{user.name}}", conditional rendering,
 * and list repetition to produce a fully resolved RenderNode tree.
 */

import type {
  SchemaNode,
  DataContext,
  RenderNode,
  BindingExpression,
  StyleProps,
} from '../types';

/** Regex to match binding expressions: {{expression}} */
const BINDING_REGEX = /\{\{([^{}]+)\}\}/g;

export class BindingEngine {
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  /**
   * Resolve an entire schema tree against a data context,
   * producing a render-ready node tree.
   */
  resolve(root: SchemaNode, context: DataContext): RenderNode | null {
    return this.resolveNode(root, context);
  }

  /**
   * Resolve a single schema node (recursive).
   */
  private resolveNode(
    node: SchemaNode,
    context: DataContext
  ): RenderNode | null {
    // 1. Evaluate conditional rendering
    if (node.condition) {
      const conditionResult = this.evaluateExpression(node.condition, context);
      if (!conditionResult) {
        this.log(`Condition false, skipping node: ${node.id}`);
        return null;
      }
    }

    // 2. Handle list repetition (repeat/for-each)
    if (node.repeat) {
      // repeat nodes are expanded by the parent; this handles the case
      // where resolveNode is called directly on a repeat node
      return this.resolveRepeatAsWrapper(node, context);
    }

    // 3. Resolve props
    const resolvedProps = this.resolveProps(node.props, context);

    // 4. Resolve style
    const resolvedStyle = node.style
      ? this.resolveStyle(node.style, context)
      : undefined;

    // 5. Resolve children
    const resolvedChildren = this.resolveChildren(
      node.children,
      context
    );

    return {
      id: node.id,
      type: node.type,
      props: resolvedProps,
      style: resolvedStyle,
      className: node.className
        ? String(this.resolveValue(node.className, context))
        : undefined,
      children:
        resolvedChildren.length > 0 ? resolvedChildren : undefined,
      events: node.events,
    };
  }

  /**
   * Resolve children, expanding any repeat nodes into multiple nodes.
   */
  private resolveChildren(
    children: SchemaNode[] | undefined,
    context: DataContext
  ): RenderNode[] {
    if (!children || children.length === 0) return [];

    const result: RenderNode[] = [];

    for (const child of children) {
      // Check condition first
      if (child.condition) {
        const conditionResult = this.evaluateExpression(
          child.condition,
          context
        );
        if (!conditionResult) continue;
      }

      if (child.repeat) {
        // Expand repeat node into multiple nodes
        const items = this.resolveBindingPath(child.repeat, context);

        if (Array.isArray(items)) {
          items.forEach((item, index) => {
            const itemContext: DataContext = {
              ...context,
              [child.repeatItem ?? 'item']: item as DataContext[string],
              [child.repeatIndex ?? 'index']: index,
            };

            const resolved = this.resolveNode(
              { ...child, repeat: undefined, condition: undefined },
              itemContext
            );
            if (resolved) {
              // Give each repeated node a unique ID
              resolved.id = `${child.id}_${index}`;
              result.push(resolved);
            }
          });
        } else {
          this.log(
            `Repeat source "${child.repeat}" did not resolve to an array for node ${child.id}`
          );
        }
      } else {
        const resolved = this.resolveNode(child, context);
        if (resolved) {
          result.push(resolved);
        }
      }
    }

    return result;
  }

  /**
   * Wrap a repeat node in a virtual container (for direct resolveNode calls).
   */
  private resolveRepeatAsWrapper(
    node: SchemaNode,
    context: DataContext
  ): RenderNode | null {
    const items = this.resolveBindingPath(node.repeat!, context);

    if (!Array.isArray(items)) {
      this.log(
        `Repeat source "${node.repeat}" is not an array for node ${node.id}`
      );
      return null;
    }

    const children: RenderNode[] = [];
    items.forEach((item, index) => {
      const itemContext: DataContext = {
        ...context,
        [node.repeatItem ?? 'item']: item as DataContext[string],
        [node.repeatIndex ?? 'index']: index,
      };

      const resolved = this.resolveNode(
        { ...node, repeat: undefined, condition: undefined },
        itemContext
      );
      if (resolved) {
        resolved.id = `${node.id}_${index}`;
        children.push(resolved);
      }
    });

    // Return a wrapper view containing the repeated nodes
    return {
      id: `${node.id}_repeat_wrapper`,
      type: 'view',
      props: {},
      children: children.length > 0 ? children : undefined,
    };
  }

  /**
   * Resolve all props, replacing binding expressions with actual values.
   */
  private resolveProps(
    props: Record<string, unknown>,
    context: DataContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(props)) {
      resolved[key] = this.resolveValue(value, context);
    }

    return resolved;
  }

  /**
   * Resolve style properties that may contain binding expressions.
   */
  private resolveStyle(
    style: StyleProps,
    context: DataContext
  ): StyleProps {
    const resolved: StyleProps = {};

    for (const [key, value] of Object.entries(style)) {
      if (value === undefined) continue;
      resolved[key] = this.resolveValue(value, context) as string | number;
    }

    return resolved;
  }

  /**
   * Resolve a single value, which may be a binding expression string,
   * a nested object, an array, or a primitive.
   */
  resolveValue(value: unknown, context: DataContext): unknown {
    if (typeof value === 'string') {
      return this.resolveStringValue(value, context);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, context));
    }

    if (value !== null && typeof value === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        resolved[k] = this.resolveValue(v, context);
      }
      return resolved;
    }

    return value;
  }

  /**
   * Resolve a string that may contain one or more binding expressions.
   *
   * - If the entire string is a single binding "{{expr}}", return the raw value
   *   (preserving type: number, boolean, object, etc.)
   * - If the string contains mixed text + bindings, interpolate as a string
   */
  private resolveStringValue(value: string, context: DataContext): unknown {
    const trimmed = value.trim();

    // Fast path: entire string is a single binding expression
    if (
      trimmed.startsWith('{{') &&
      trimmed.endsWith('}}') &&
      trimmed.indexOf('{{', 2) === -1
    ) {
      const expr = trimmed.slice(2, -2).trim();
      return this.resolveBindingPath(expr, context);
    }

    // Mixed content: interpolate all bindings as strings
    return value.replace(BINDING_REGEX, (_, expr: string) => {
      const resolved = this.resolveBindingPath(expr.trim(), context);
      return resolved === undefined || resolved === null
        ? ''
        : String(resolved);
    });
  }

  /**
   * Resolve a dot-path expression against the data context.
   * Supports: "user.name", "list[0].title", "items.length"
   */
  resolveBindingPath(
    expr: BindingExpression,
    context: DataContext
  ): unknown {
    if (!expr) return undefined;

    const parts = this.parsePath(expr);
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;

      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Evaluate a binding expression as a boolean for conditional rendering.
   * Supports simple truthy checks and basic comparisons.
   */
  evaluateExpression(
    expr: BindingExpression,
    context: DataContext
  ): boolean {
    const trimmed = expr.trim();

    // Handle "{{expr}}" wrapper
    const unwrapped =
      trimmed.startsWith('{{') && trimmed.endsWith('}}')
        ? trimmed.slice(2, -2).trim()
        : trimmed;

    // Negation: "!expr"
    if (unwrapped.startsWith('!')) {
      return !this.evaluateExpression(unwrapped.slice(1), context);
    }

    // Comparison operators
    const comparisonMatch = unwrapped.match(
      /^(\S+)\s*(===|!==|==|!=|>=|<=|>|<)\s*(\S+)$/
    );
    if (comparisonMatch) {
      const left = this.resolveComparisonOperand(
        comparisonMatch[1].trim(),
        context
      );
      const right = this.resolveComparisonOperand(
        comparisonMatch[3].trim(),
        context
      );
      return this.compareValues(left, right, comparisonMatch[2]);
    }

    // Simple truthy check
    const value = this.resolveBindingPath(unwrapped, context);
    return !!value;
  }

  /**
   * Resolve a comparison operand, which could be a literal or a binding path.
   */
  private resolveComparisonOperand(
    operand: string,
    context: DataContext
  ): unknown {
    // String literal
    if (
      (operand.startsWith("'") && operand.endsWith("'")) ||
      (operand.startsWith('"') && operand.endsWith('"'))
    ) {
      return operand.slice(1, -1);
    }

    // Number literal
    if (!isNaN(Number(operand))) {
      return Number(operand);
    }

    // Boolean literals
    if (operand === 'true') return true;
    if (operand === 'false') return false;
    if (operand === 'null') return null;
    if (operand === 'undefined') return undefined;

    // Otherwise, treat as a binding path
    return this.resolveBindingPath(operand, context);
  }

  /**
   * Compare two values with the given operator.
   */
  private compareValues(
    left: unknown,
    right: unknown,
    operator: string
  ): boolean {
    switch (operator) {
      case '===':
        return left === right;
      case '!==':
        return left !== right;
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '>':
        return (left as number) > (right as number);
      case '<':
        return (left as number) < (right as number);
      case '>=':
        return (left as number) >= (right as number);
      case '<=':
        return (left as number) <= (right as number);
      default:
        return false;
    }
  }

  /**
   * Parse a dot-path expression into path segments.
   * Handles both dot notation and bracket notation:
   * "user.name" -> ["user", "name"]
   * "list[0].title" -> ["list", "0", "title"]
   */
  private parsePath(expr: string): string[] {
    const parts: string[] = [];
    let current = '';

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];

      if (char === '.') {
        if (current) parts.push(current);
        current = '';
      } else if (char === '[') {
        if (current) parts.push(current);
        current = '';
      } else if (char === ']') {
        if (current) parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current) parts.push(current);
    return parts;
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[A2UI BindingEngine] ${message}`);
    }
  }
}
