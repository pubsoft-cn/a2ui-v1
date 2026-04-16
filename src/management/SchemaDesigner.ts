/**
 * SchemaDesigner - Schema Creation & Editing Helper
 *
 * Provides template-based schema creation, node building utilities,
 * and design-time validation.
 */

import type {
  SchemaDocument,
  SchemaNode,
  SchemaMeta,
  ComponentType,
  DataSourceDeclaration,
} from '../types';
import type {
  SchemaTemplate,
  DesignValidationResult,
  DesignValidationError,
  DesignValidationWarning,
} from './types';

export class SchemaDesigner {
  private templates: Map<string, SchemaTemplate> = new Map();
  private nodeIdCounter = 0;

  constructor() {
    this.registerBuiltinTemplates();
  }

  /**
   * Create a new empty schema document.
   */
  createEmptySchema(meta?: Partial<SchemaMeta>): SchemaDocument {
    return {
      version: this.generateVersion(),
      meta: {
        title: meta?.title ?? 'Untitled Page',
        description: meta?.description,
        backgroundColor: meta?.backgroundColor ?? '#ffffff',
        navigationBar: meta?.navigationBar ?? {
          title: meta?.title ?? 'Untitled',
          backgroundColor: '#ffffff',
          textStyle: 'black',
        },
      },
      root: this.createNode('view', { flex: '1' }),
      dataSources: [],
    };
  }

  /**
   * Create a schema from a template.
   */
  createFromTemplate(templateId: string): SchemaDocument | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const schema: SchemaDocument = JSON.parse(
      JSON.stringify(template.schema)
    );
    schema.version = this.generateVersion();
    return schema;
  }

  /**
   * Create a new schema node.
   */
  createNode(
    type: ComponentType,
    props?: Record<string, unknown>,
    options?: {
      style?: Record<string, string | number>;
      children?: SchemaNode[];
      events?: SchemaNode['events'];
      condition?: string;
    }
  ): SchemaNode {
    const id = `node_${++this.nodeIdCounter}`;
    return {
      id,
      type,
      props: props ?? {},
      style: options?.style,
      children: options?.children,
      events: options?.events,
      condition: options?.condition,
    };
  }

  /**
   * Add a child node to a parent node in the schema tree.
   */
  addChild(parent: SchemaNode, child: SchemaNode): SchemaNode {
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(child);
    return parent;
  }

  /**
   * Remove a child node by ID from a parent.
   */
  removeChild(parent: SchemaNode, childId: string): boolean {
    if (!parent.children) return false;
    const index = parent.children.findIndex((c) => c.id === childId);
    if (index === -1) return false;
    parent.children.splice(index, 1);
    return true;
  }

  /**
   * Find a node by ID in the schema tree.
   */
  findNode(root: SchemaNode, nodeId: string): SchemaNode | null {
    if (root.id === nodeId) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = this.findNode(child, nodeId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Add a data source declaration to a schema.
   */
  addDataSource(
    schema: SchemaDocument,
    ds: DataSourceDeclaration
  ): SchemaDocument {
    if (!schema.dataSources) {
      schema.dataSources = [];
    }
    schema.dataSources.push(ds);
    return schema;
  }

  /**
   * Validate a schema document for design-time errors and warnings.
   */
  validate(schema: SchemaDocument): DesignValidationResult {
    const errors: DesignValidationError[] = [];
    const warnings: DesignValidationWarning[] = [];

    // Validate root
    if (!schema.version) {
      errors.push({
        nodeId: 'root',
        path: 'version',
        message: 'Schema version is required',
      });
    }

    if (!schema.root) {
      errors.push({
        nodeId: 'root',
        path: 'root',
        message: 'Schema root node is required',
      });
      return { valid: false, errors, warnings };
    }

    // Validate node tree
    const seenIds = new Set<string>();
    this.validateNode(schema.root, 'root', seenIds, errors, warnings, 0);

    // Validate data sources
    if (schema.dataSources) {
      const seenKeys = new Set<string>();
      for (const ds of schema.dataSources) {
        if (seenKeys.has(ds.key)) {
          errors.push({
            nodeId: 'dataSources',
            path: `dataSources.${ds.key}`,
            message: `Duplicate data source key: "${ds.key}"`,
          });
        }
        seenKeys.add(ds.key);

        if (!ds.api) {
          errors.push({
            nodeId: 'dataSources',
            path: `dataSources.${ds.key}.api`,
            message: `Data source "${ds.key}" missing API endpoint`,
          });
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Get all registered templates.
   */
  getTemplates(): SchemaTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Register a custom template.
   */
  registerTemplate(template: SchemaTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Count total nodes in a schema tree.
   */
  countNodes(node: SchemaNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  /**
   * Collect all binding expressions from a schema tree.
   */
  collectBindings(node: SchemaNode): string[] {
    const bindings: string[] = [];
    this.collectBindingsRecursive(node, bindings);
    return bindings;
  }

  private collectBindingsRecursive(
    node: SchemaNode,
    bindings: string[]
  ): void {
    // Check props for binding expressions
    for (const value of Object.values(node.props)) {
      if (typeof value === 'string' && value.includes('{{')) {
        bindings.push(value);
      }
    }

    // Check condition
    if (node.condition) bindings.push(node.condition);

    // Check repeat
    if (node.repeat) bindings.push(node.repeat);

    // Recurse children
    if (node.children) {
      for (const child of node.children) {
        this.collectBindingsRecursive(child, bindings);
      }
    }
  }

  private validateNode(
    node: SchemaNode,
    path: string,
    seenIds: Set<string>,
    errors: DesignValidationError[],
    warnings: DesignValidationWarning[],
    depth: number
  ): void {
    // Check for missing ID
    if (!node.id) {
      errors.push({
        nodeId: node.id || 'unknown',
        path: `${path}.id`,
        message: 'Node missing required "id" field',
      });
    }

    // Check for duplicate IDs
    if (node.id && seenIds.has(node.id)) {
      errors.push({
        nodeId: node.id,
        path: `${path}.id`,
        message: `Duplicate node ID: "${node.id}"`,
      });
    }
    if (node.id) seenIds.add(node.id);

    // Check for missing type
    if (!node.type) {
      errors.push({
        nodeId: node.id,
        path: `${path}.type`,
        message: 'Node missing required "type" field',
      });
    }

    // Depth warning
    if (depth > 10) {
      warnings.push({
        nodeId: node.id,
        path,
        message: `Deep nesting detected (depth: ${depth}). Consider flattening.`,
      });
    }

    // Validate children
    if (node.children) {
      node.children.forEach((child, index) => {
        this.validateNode(
          child,
          `${path}.children[${index}]`,
          seenIds,
          errors,
          warnings,
          depth + 1
        );
      });
    }
  }

  private registerBuiltinTemplates(): void {
    // Blank page template
    this.registerTemplate({
      id: 'blank',
      name: 'Blank Page',
      description: 'An empty page with a single view container',
      category: 'page',
      schema: {
        version: '1.0.0',
        meta: {
          title: 'Blank Page',
          backgroundColor: '#ffffff',
          navigationBar: { title: 'Blank Page', textStyle: 'black' },
        },
        root: { id: 'root', type: 'view', props: {} },
      },
    });

    // List page template
    this.registerTemplate({
      id: 'list-page',
      name: 'List Page',
      description: 'A page with a scrollable list',
      category: 'list',
      schema: {
        version: '1.0.0',
        meta: {
          title: 'List Page',
          backgroundColor: '#f5f5f5',
          navigationBar: { title: 'List', textStyle: 'black' },
        },
        root: {
          id: 'root',
          type: 'scroll-view',
          props: { scrollY: true },
          children: [
            {
              id: 'list-item',
              type: 'view',
              props: {},
              repeat: '{{items}}',
              repeatItem: 'item',
              repeatIndex: 'index',
              children: [
                {
                  id: 'item-title',
                  type: 'text',
                  props: { content: '{{item.title}}' },
                },
                {
                  id: 'item-desc',
                  type: 'text',
                  props: { content: '{{item.description}}' },
                },
              ],
            },
          ],
        },
        dataSources: [
          {
            key: 'items',
            api: '/api/items',
            method: 'GET',
          },
        ],
      },
    });

    // Detail page template
    this.registerTemplate({
      id: 'detail-page',
      name: 'Detail Page',
      description: 'A page for displaying detail information',
      category: 'detail',
      schema: {
        version: '1.0.0',
        meta: {
          title: 'Detail',
          backgroundColor: '#ffffff',
          navigationBar: { title: 'Detail', textStyle: 'black' },
        },
        root: {
          id: 'root',
          type: 'scroll-view',
          props: { scrollY: true },
          children: [
            {
              id: 'header-image',
              type: 'image',
              props: { src: '{{detail.image}}', mode: 'aspectFill' },
              style: { width: '100%', height: 200 },
            },
            {
              id: 'title',
              type: 'text',
              props: { content: '{{detail.title}}' },
              style: { fontSize: 20, fontWeight: 'bold', padding: 16 },
            },
            {
              id: 'content',
              type: 'text',
              props: { content: '{{detail.content}}' },
              style: { fontSize: 14, padding: 16 },
            },
          ],
        },
        dataSources: [
          {
            key: 'detail',
            api: '/api/detail',
            method: 'GET',
            params: { id: ':id' },
          },
        ],
      },
    });

    // Form page template
    this.registerTemplate({
      id: 'form-page',
      name: 'Form Page',
      description: 'A page with a form for data input',
      category: 'form',
      schema: {
        version: '1.0.0',
        meta: {
          title: 'Form',
          backgroundColor: '#ffffff',
          navigationBar: { title: 'Form', textStyle: 'black' },
        },
        root: {
          id: 'root',
          type: 'form',
          props: {},
          children: [
            {
              id: 'name-input',
              type: 'input',
              props: { placeholder: 'Enter name', value: '{{form.name}}' },
            },
            {
              id: 'submit-btn',
              type: 'button',
              props: { text: 'Submit' },
              events: [
                {
                  type: 'tap',
                  action: { type: 'api', payload: { api: '/api/submit', method: 'POST' } },
                },
              ],
            },
          ],
        },
      },
    });
  }

  private generateVersion(): string {
    return `v${Date.now().toString(36)}`;
  }
}
