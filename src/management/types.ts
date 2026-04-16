/**
 * Management Platform - Type Definitions
 *
 * Defines types for the SchemaDocument management platform including
 * design, preview, testing, and publishing workflows.
 */

import type { SchemaDocument, SchemaNode, DataContext, RenderNode } from '../types';

// ─── Schema Management ─────────────────────────────────────────

/** Schema document status in the management lifecycle */
export type SchemaStatus = 'draft' | 'testing' | 'preview' | 'published' | 'archived';

/** Managed schema document with metadata */
export interface ManagedSchema {
  /** Unique schema identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description?: string;
  /** Current lifecycle status */
  status: SchemaStatus;
  /** The actual schema document */
  schema: SchemaDocument;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Author identifier */
  author?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Version history references */
  versions: SchemaVersionRecord[];
}

/** Record of a published schema version */
export interface SchemaVersionRecord {
  /** Version hash */
  version: string;
  /** Publish timestamp */
  publishedAt: string;
  /** Change description */
  changelog?: string;
  /** OSS URL if published */
  ossUrl?: string;
}

// ─── Schema Designer ───────────────────────────────────────────

/** Template for creating new schemas */
export interface SchemaTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template category */
  category: 'page' | 'component' | 'form' | 'list' | 'detail';
  /** The template schema */
  schema: SchemaDocument;
  /** Thumbnail preview (SVG string) */
  thumbnail?: string;
}

/** Node builder configuration for drag-and-drop design */
export interface NodeBuilderConfig {
  /** Available component types */
  componentTypes: string[];
  /** Default props for each type */
  defaultPropsMap: Record<string, Record<string, unknown>>;
  /** Maximum nesting depth */
  maxDepth: number;
}

/** Validation result from schema designer */
export interface DesignValidationResult {
  /** Whether the schema is valid */
  valid: boolean;
  /** Validation errors */
  errors: DesignValidationError[];
  /** Validation warnings */
  warnings: DesignValidationWarning[];
}

export interface DesignValidationError {
  /** Node ID where the error occurs */
  nodeId: string;
  /** Error path */
  path: string;
  /** Error message */
  message: string;
}

export interface DesignValidationWarning {
  /** Node ID */
  nodeId: string;
  /** Warning path */
  path: string;
  /** Warning message */
  message: string;
}

// ─── Preview ───────────────────────────────────────────────────

/** Preview configuration */
export interface PreviewConfig {
  /** Preview mode */
  mode: 'desktop' | 'mobile' | 'miniprogram';
  /** Viewport width */
  width: number;
  /** Viewport height */
  height: number;
  /** Device pixel ratio */
  devicePixelRatio?: number;
  /** Whether to show component outlines */
  showOutlines?: boolean;
  /** Whether to show binding expressions */
  showBindings?: boolean;
}

/** Preview snapshot result */
export interface PreviewSnapshot {
  /** The render tree used for preview */
  renderTree: RenderNode;
  /** Resolved data context */
  dataContext: DataContext;
  /** Preview configuration used */
  config: PreviewConfig;
  /** Snapshot timestamp */
  timestamp: string;
  /** SVG diagram output */
  diagram?: string;
}

// ─── Binding Test ──────────────────────────────────────────────

/** Binding test case */
export interface BindingTestCase {
  /** Test case name */
  name: string;
  /** Description */
  description?: string;
  /** Input data context */
  inputData: DataContext;
  /** Expected binding results (nodeId -> expected props) */
  expectedResults?: Record<string, Record<string, unknown>>;
}

/** Binding test result */
export interface BindingTestResult {
  /** Test case name */
  testName: string;
  /** Whether all assertions passed */
  passed: boolean;
  /** Total binding expressions evaluated */
  totalBindings: number;
  /** Successfully resolved bindings */
  resolvedBindings: number;
  /** Failed/unresolved bindings */
  unresolvedBindings: UnresolvedBinding[];
  /** Assertion results */
  assertions: BindingAssertion[];
  /** Duration in ms */
  duration: number;
}

export interface UnresolvedBinding {
  /** Node ID */
  nodeId: string;
  /** Property name */
  prop: string;
  /** The binding expression */
  expression: string;
  /** Resolved value (undefined if unresolved) */
  resolvedValue: unknown;
}

export interface BindingAssertion {
  /** Node ID */
  nodeId: string;
  /** Property name */
  prop: string;
  /** Expected value */
  expected: unknown;
  /** Actual value */
  actual: unknown;
  /** Whether assertion passed */
  passed: boolean;
}

// ─── Mock Test ─────────────────────────────────────────────────

/** Mock data source configuration */
export interface MockDataSource {
  /** Data source key (matches DataSourceDeclaration.key) */
  key: string;
  /** Mock response data */
  data: unknown;
  /** Simulated delay in ms */
  delay?: number;
  /** Whether to simulate an error */
  simulateError?: boolean;
  /** Error message if simulating error */
  errorMessage?: string;
}

/** Mock test scenario */
export interface MockTestScenario {
  /** Scenario name */
  name: string;
  /** Description */
  description?: string;
  /** Mock data sources */
  mockDataSources: MockDataSource[];
  /** Route parameters */
  routeParams?: Record<string, string>;
  /** Expected render node count */
  expectedNodeCount?: number;
  /** Expected component types in output */
  expectedTypes?: string[];
}

/** Mock test result */
export interface MockTestResult {
  /** Scenario name */
  scenarioName: string;
  /** Whether the test passed */
  passed: boolean;
  /** Rendered node count */
  nodeCount: number;
  /** Component types found */
  componentTypes: string[];
  /** Errors encountered */
  errors: string[];
  /** Render tree snapshot */
  renderTree?: RenderNode;
  /** Duration in ms */
  duration: number;
}

// ─── OSS Publisher ─────────────────────────────────────────────

/** OSS provider configuration */
export interface OSSConfig {
  /** OSS provider type */
  provider: 'aliyun' | 'tencent' | 'aws' | 'custom';
  /** OSS bucket name */
  bucket: string;
  /** OSS region */
  region: string;
  /** Base path prefix in the bucket */
  basePath: string;
  /** CDN base URL for published schemas */
  cdnBaseUrl: string;
  /** Custom upload function for 'custom' provider */
  customUpload?: OSSUploadAdapter;
}

/** OSS upload adapter interface */
export interface OSSUploadAdapter {
  upload(key: string, content: string, contentType: string): Promise<OSSUploadResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** OSS upload result */
export interface OSSUploadResult {
  /** Published URL */
  url: string;
  /** Content hash */
  hash: string;
  /** Upload timestamp */
  timestamp: string;
  /** Content size in bytes */
  size: number;
}

/** Publish options */
export interface PublishOptions {
  /** Version tag */
  version?: string;
  /** Changelog description */
  changelog?: string;
  /** Whether to set as latest version */
  setLatest?: boolean;
  /** Whether to invalidate CDN cache */
  invalidateCache?: boolean;
}

/** Publish result */
export interface PublishResult {
  /** Whether publish was successful */
  success: boolean;
  /** Published URL */
  url: string;
  /** Version hash */
  version: string;
  /** Schema ID */
  schemaId: string;
  /** Publish timestamp */
  publishedAt: string;
  /** Errors if any */
  errors?: string[];
}

// ─── UI Diagram ────────────────────────────────────────────────

/** Diagram type */
export type DiagramType =
  | 'management-design'
  | 'management-preview'
  | 'miniprogram-preview'
  | 'miniprogram-operation';

/** Diagram generation config */
export interface DiagramConfig {
  /** Diagram type */
  type: DiagramType;
  /** Output width */
  width: number;
  /** Output height */
  height: number;
  /** Title */
  title: string;
  /** Whether to show grid */
  showGrid?: boolean;
  /** Theme */
  theme?: 'light' | 'dark';
}

/** Generated diagram result */
export interface DiagramResult {
  /** Diagram type */
  type: DiagramType;
  /** SVG content */
  svg: string;
  /** Title */
  title: string;
  /** Generation timestamp */
  generatedAt: string;
}
