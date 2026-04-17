/**
 * BuildParams - Parameter Mapping Engine
 *
 * Resolves template expressions in action parameters:
 * - ${formData.xxx} - references form input data
 * - ${context.row.xxx} - references the current row context (e.g., in a list)
 * - ${context.xxx} - references general context values
 *
 * Designed for high-performance RPC parameter assembly.
 */

/**
 * Regex to match ${...} template expressions.
 * Uses negated character class to prevent ReDoS.
 */
const TEMPLATE_REGEX = /\$\{([^}]+)\}/g;

/** Context object passed to buildParams */
export interface BuildParamsContext {
  /** Form data (user input values) */
  formData?: Record<string, unknown>;
  /** Row/item context (e.g., current list item) */
  row?: Record<string, unknown>;
  /** General context values */
  [key: string]: unknown;
}

export class BuildParams {
  /**
   * Resolve all template expressions in a params object.
   * Returns a new object with all ${...} expressions replaced.
   */
  static resolve(
    template: Record<string, unknown>,
    context: BuildParamsContext
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = BuildParams.resolveValue(value, context);
    }
    return result;
  }

  /**
   * Resolve a single value, which may be a template string,
   * nested object, array, or primitive.
   */
  static resolveValue(value: unknown, context: BuildParamsContext): unknown {
    if (typeof value === 'string') {
      return BuildParams.resolveString(value, context);
    }

    if (Array.isArray(value)) {
      return value.map((item) => BuildParams.resolveValue(item, context));
    }

    if (value !== null && typeof value === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        resolved[k] = BuildParams.resolveValue(v, context);
      }
      return resolved;
    }

    return value;
  }

  /**
   * Resolve a template string.
   *
   * - If the entire string is a single expression "${expr}", return the raw value
   *   (preserving type: number, boolean, object, etc.)
   * - If the string contains mixed text + expressions, interpolate as a string.
   */
  static resolveString(value: string, context: BuildParamsContext): unknown {
    const trimmed = value.trim();

    // Fast path: entire string is a single template expression
    if (
      trimmed.startsWith('${') &&
      trimmed.endsWith('}') &&
      trimmed.indexOf('${', 2) === -1
    ) {
      const expr = trimmed.slice(2, -1).trim();
      return BuildParams.resolvePath(expr, context);
    }

    // Mixed content: interpolate all templates as strings
    return value.replace(TEMPLATE_REGEX, (_, expr: string) => {
      const resolved = BuildParams.resolvePath(expr.trim(), context);
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }

  /**
   * Resolve a dot-path expression against the context.
   *
   * Supported prefixes:
   * - "formData.xxx" -> context.formData.xxx
   * - "context.row.xxx" -> context.row.xxx
   * - "context.xxx" -> context.xxx
   * - "xxx" -> context.xxx (shorthand)
   */
  static resolvePath(expr: string, context: BuildParamsContext): unknown {
    if (!expr) return undefined;

    const parts = BuildParams.parsePath(expr);
    let current: unknown = context;

    // Navigate the path from the root context
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
   * Parse a dot-path expression into segments.
   * Handles dot notation and bracket notation.
   */
  private static parsePath(expr: string): string[] {
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
}
