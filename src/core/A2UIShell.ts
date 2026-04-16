/**
 * A2UIShell - Main Orchestrator
 *
 * The Shell is the central coordinator that ties together the dual-channel
 * fetching (SchemaLoader + DataFetcher), binding (BindingEngine), and
 * rendering (Renderer) into a single, easy-to-use API.
 *
 * Usage:
 *   const shell = new A2UIShell(config);
 *   const output = await shell.loadAndRender({ pageKey: 'home', version: 'abc123' });
 */

import { SchemaLoader, type HttpAdapter } from './SchemaLoader';
import { DataFetcher, type DataHttpAdapter } from './DataFetcher';
import { BindingEngine } from './BindingEngine';
import { Renderer, type EventHandler, type ComponentRenderOutput } from './Renderer';
import type {
  ShellConfig,
  ShellPageParams,
  ShellLifecycleHooks,
  ShellError,
  SchemaDocument,
  DataContext,
  RenderNode,
} from '../types';

/** Result of a full shell render cycle */
export interface ShellRenderResult {
  /** The fetched schema document */
  schema: SchemaDocument;
  /** The aggregated data context */
  data: DataContext;
  /** The resolved render tree (after binding) */
  renderTree: RenderNode;
  /** The final component output tree */
  output: ComponentRenderOutput;
  /** Performance timing information */
  timing: ShellTiming;
}

/** Performance timing for the render cycle */
export interface ShellTiming {
  /** Time to load schema (ms) */
  schemaLoadTime: number;
  /** Time to fetch all data (ms) */
  dataFetchTime: number;
  /** Time to bind schema + data (ms) */
  bindingTime: number;
  /** Time to render component tree (ms) */
  renderTime: number;
  /** Total end-to-end time (ms) */
  totalTime: number;
}

export class A2UIShell {
  private schemaLoader: SchemaLoader;
  private dataFetcher: DataFetcher;
  private bindingEngine: BindingEngine;
  private renderer: Renderer;
  private config: ShellConfig;
  private hooks: ShellLifecycleHooks;

  constructor(
    config: ShellConfig,
    options?: {
      httpAdapter?: HttpAdapter;
      dataHttpAdapter?: DataHttpAdapter;
      hooks?: ShellLifecycleHooks;
    }
  ) {
    this.config = config;
    this.hooks = options?.hooks ?? {};

    this.schemaLoader = new SchemaLoader(config, options?.httpAdapter);
    this.dataFetcher = new DataFetcher(config, options?.dataHttpAdapter);
    this.bindingEngine = new BindingEngine(config.debug);
    this.renderer = new Renderer(config.debug);
  }

  /**
   * Full render cycle: load schema + data in parallel, bind, and render.
   * This is the primary API for the Shell.
   */
  async loadAndRender(params: ShellPageParams): Promise<ShellRenderResult> {
    const totalStart = Date.now();

    try {
      // ── Step 1: Load Schema (Channel 1) ───────────────────────
      const schemaStart = Date.now();
      const schema = await this.schemaLoader.load(
        params.pageKey,
        params.version
      );
      const schemaLoadTime = Date.now() - schemaStart;

      this.hooks.onSchemaLoaded?.(schema);

      // ── Step 2: Fetch Data (Channel 2) ────────────────────────
      const dataStart = Date.now();
      const data = await this.dataFetcher.fetchAll(
        schema.dataSources ?? [],
        params.params
      );
      const dataFetchTime = Date.now() - dataStart;

      this.hooks.onDataLoaded?.(data);

      // ── Step 3: Bind Schema + Data ────────────────────────────
      const bindStart = Date.now();
      const renderTree = this.bindingEngine.resolve(schema.root, data);
      const bindingTime = Date.now() - bindStart;

      if (!renderTree) {
        throw this.createError(
          'binding',
          'Root node resolved to null - the entire page is conditionally hidden'
        );
      }

      // ── Step 4: Render ────────────────────────────────────────
      const renderStart = Date.now();
      const output = this.renderer.render(renderTree);
      const renderTime = Date.now() - renderStart;

      if (!output) {
        throw this.createError(
          'render',
          'Renderer produced null output for root node'
        );
      }

      this.hooks.onRenderComplete?.();

      const totalTime = Date.now() - totalStart;

      return {
        schema,
        data,
        renderTree,
        output,
        timing: {
          schemaLoadTime,
          dataFetchTime,
          bindingTime,
          renderTime,
          totalTime,
        },
      };
    } catch (error) {
      const shellError = this.normalizeError(error);
      this.hooks.onError?.(shellError);
      throw shellError;
    }
  }

  /**
   * Optimized parallel loading: fetch Schema and Data concurrently
   * when the data source declarations are known ahead of time.
   */
  async loadAndRenderParallel(
    params: ShellPageParams,
    knownDataSources?: SchemaDocument['dataSources']
  ): Promise<ShellRenderResult> {
    const totalStart = Date.now();

    try {
      // If we know the data sources, we can fetch schema and data in parallel
      if (knownDataSources && knownDataSources.length > 0) {
        const schemaStart = Date.now();
        const [schema, data] = await Promise.all([
          this.schemaLoader.load(params.pageKey, params.version),
          this.dataFetcher.fetchAll(knownDataSources, params.params),
        ]);
        const parallelTime = Date.now() - schemaStart;

        this.hooks.onSchemaLoaded?.(schema);
        this.hooks.onDataLoaded?.(data);

        const bindStart = Date.now();
        const renderTree = this.bindingEngine.resolve(schema.root, data);
        const bindingTime = Date.now() - bindStart;

        if (!renderTree) {
          throw this.createError('binding', 'Root node resolved to null');
        }

        const renderStart = Date.now();
        const output = this.renderer.render(renderTree);
        const renderTime = Date.now() - renderStart;

        if (!output) {
          throw this.createError('render', 'Renderer produced null output');
        }

        this.hooks.onRenderComplete?.();

        return {
          schema,
          data,
          renderTree,
          output,
          timing: {
            schemaLoadTime: parallelTime,
            dataFetchTime: parallelTime,
            bindingTime,
            renderTime,
            totalTime: Date.now() - totalStart,
          },
        };
      }

      // Fallback to sequential loading
      return this.loadAndRender(params);
    } catch (error) {
      const shellError = this.normalizeError(error);
      this.hooks.onError?.(shellError);
      throw shellError;
    }
  }

  /**
   * Set the global event handler for user interactions.
   */
  setEventHandler(handler: EventHandler): void {
    this.renderer.setEventHandler(handler);
  }

  /**
   * Get the SchemaLoader instance for advanced usage.
   */
  getSchemaLoader(): SchemaLoader {
    return this.schemaLoader;
  }

  /**
   * Get the DataFetcher instance for advanced usage.
   */
  getDataFetcher(): DataFetcher {
    return this.dataFetcher;
  }

  /**
   * Get the BindingEngine instance for advanced usage.
   */
  getBindingEngine(): BindingEngine {
    return this.bindingEngine;
  }

  /**
   * Get the Renderer instance for advanced usage.
   */
  getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Invalidate all caches (schema + data).
   */
  clearAllCaches(): void {
    this.schemaLoader.clearCache();
    this.dataFetcher.clearCache();
  }

  private createError(
    type: ShellError['type'],
    message: string,
    detail?: unknown
  ): ShellError {
    return { type, message, detail };
  }

  private normalizeError(error: unknown): ShellError {
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      'message' in error
    ) {
      return error as ShellError;
    }

    const message = error instanceof Error ? error.message : String(error);
    return this.createError('render', message, error);
  }
}
