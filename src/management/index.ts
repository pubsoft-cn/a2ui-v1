/**
 * Management Platform - Module Index
 *
 * Re-exports all management platform modules.
 */

export { SchemaManager } from './SchemaManager';
export { SchemaDesigner } from './SchemaDesigner';
export { SchemaPreviewEngine } from './SchemaPreviewEngine';
export { BindingTester } from './BindingTester';
export { MockTestRunner } from './MockTestRunner';
export { OSSPublisher, createInMemoryAdapter } from './OSSPublisher';
export { UITestDiagramGenerator } from './UITestDiagramGenerator';

export type {
  // Schema Management
  SchemaStatus,
  ManagedSchema,
  SchemaVersionRecord,
  // Designer
  SchemaTemplate,
  NodeBuilderConfig,
  DesignValidationResult,
  DesignValidationError,
  DesignValidationWarning,
  // Preview
  PreviewConfig,
  PreviewSnapshot,
  // Binding Test
  BindingTestCase,
  BindingTestResult,
  UnresolvedBinding,
  BindingAssertion,
  // Mock Test
  MockDataSource,
  MockTestScenario,
  MockTestResult,
  // OSS Publisher
  OSSConfig,
  OSSUploadAdapter,
  OSSUploadResult,
  PublishOptions,
  PublishResult,
  // Diagrams
  DiagramType,
  DiagramConfig,
  DiagramResult,
} from './types';
