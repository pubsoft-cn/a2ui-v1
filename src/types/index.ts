/**
 * A2UI Shell - Core Type Definitions
 *
 * Defines the Schema, Data, and rendering types used throughout
 * the SDUI dual-channel architecture.
 */

// ─── Schema Types ──────────────────────────────────────────────

/** Supported built-in component types */
export type ComponentType =
  | 'view'
  | 'text'
  | 'image'
  | 'button'
  | 'input'
  | 'list'
  | 'scroll-view'
  | 'swiper'
  | 'form'
  | 'custom';

/** Style properties applicable to a component */
export interface StyleProps {
  [key: string]: string | number | undefined;
}

/** Event binding definition in schema */
export interface EventBinding {
  /** Event name (e.g. 'tap', 'input', 'scroll') */
  type: string;
  /** Action to trigger */
  action: ActionDefinition;
}

/** Action definition triggered by events */
export interface ActionDefinition {
  /** Action type: navigate, api, setState, custom */
  type: 'navigate' | 'api' | 'setState' | 'custom';
  /** Action payload */
  payload: Record<string, unknown>;
}

/** Data binding expression (e.g. "{{user.name}}") */
export type BindingExpression = string;

/** A single component node in the schema tree */
export interface SchemaNode {
  /** Unique identifier for this node */
  id: string;
  /** Component type to render */
  type: ComponentType;
  /** Props to pass to the component, may contain binding expressions */
  props: Record<string, unknown>;
  /** Style properties */
  style?: StyleProps;
  /** CSS class names */
  className?: string;
  /** Child nodes */
  children?: SchemaNode[];
  /** Event bindings */
  events?: EventBinding[];
  /** Conditional rendering expression */
  condition?: BindingExpression;
  /** List rendering: data source binding expression */
  repeat?: BindingExpression;
  /** List rendering: iterator variable name */
  repeatItem?: string;
  /** List rendering: index variable name */
  repeatIndex?: string;
}

/** Top-level schema document fetched from CDN/Redis */
export interface SchemaDocument {
  /** Schema version identifier / hash */
  version: string;
  /** Page-level metadata */
  meta: SchemaMeta;
  /** Root component tree */
  root: SchemaNode;
  /** Data source declarations for the Data channel */
  dataSources?: DataSourceDeclaration[];
}

/** Page metadata within a schema */
export interface SchemaMeta {
  title?: string;
  description?: string;
  /** Background color */
  backgroundColor?: string;
  /** Navigation bar configuration */
  navigationBar?: {
    title?: string;
    backgroundColor?: string;
    textStyle?: 'white' | 'black';
  };
}

/** Declaration of a data source the page depends on */
export interface DataSourceDeclaration {
  /** Unique key for this data source */
  key: string;
  /** API endpoint path */
  api: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Request parameters (may contain binding expressions) */
  params?: Record<string, unknown>;
  /** Whether to auto-refresh on page show */
  autoRefresh?: boolean;
  /** Cache TTL in seconds, 0 means no cache */
  cacheTTL?: number;
}

// ─── Data Types ────────────────────────────────────────────────

/** API request assembled from DataSourceDeclaration */
export interface ApiRequest {
  /** Resolved API URL */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Request headers */
  headers: Record<string, string>;
  /** Request body or query params */
  params?: Record<string, unknown>;
  /** Request timeout in ms */
  timeout?: number;
}

/** Standardized API response envelope */
export interface ApiResponse<T = unknown> {
  /** Business status code */
  code: number;
  /** Response message */
  message: string;
  /** Response data payload */
  data: T;
}

/** Resolved data context for binding */
export interface DataContext {
  [key: string]: unknown;
}

// ─── Shell Types ───────────────────────────────────────────────

/** Configuration for the A2UI Shell instance */
export interface ShellConfig {
  /** Base URL for Schema CDN */
  schemaCdnBase: string;
  /** Base URL for Data API */
  apiBase: string;
  /** Default request timeout in ms */
  timeout?: number;
  /** Default request headers */
  headers?: Record<string, string>;
  /** Enable debug logging */
  debug?: boolean;
  /** Schema cache strategy */
  cacheStrategy?: 'none' | 'memory' | 'storage';
}

/** Shell page route parameters */
export interface ShellPageParams {
  /** Schema identifier (page key) */
  pageKey: string;
  /** Schema version hash for cache busting */
  version?: string;
  /** Additional route parameters to inject into data context */
  params?: Record<string, string>;
}

/** Lifecycle hooks for the Shell */
export interface ShellLifecycleHooks {
  onSchemaLoaded?: (schema: SchemaDocument) => void;
  onDataLoaded?: (data: DataContext) => void;
  onRenderComplete?: () => void;
  onError?: (error: ShellError) => void;
}

/** Shell error types */
export interface ShellError {
  type: 'schema' | 'data' | 'binding' | 'render';
  message: string;
  detail?: unknown;
}

/** Render tree node - the result of binding schema + data */
export interface RenderNode {
  id: string;
  type: ComponentType;
  props: Record<string, unknown>;
  style?: StyleProps;
  className?: string;
  children?: RenderNode[];
  events?: EventBinding[];
}
