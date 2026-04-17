/**
 * A2UI Shell - Cross-platform SDUI Rendering Engine
 *
 * Main entry point. Re-exports all public APIs.
 */

// Core engine
export {
  A2UIShell,
  SchemaLoader,
  DataFetcher,
  BindingEngine,
  Renderer,
  ConnectionBridge,
  EnvelopeProtocol,
  BuildParams,
  ActionEngine,
  ListContainer,
} from './core';

export type {
  HttpAdapter,
  DataHttpAdapter,
  ComponentRenderOutput,
  ComponentDefinition,
  EventHandler,
  ShellRenderResult,
  ShellTiming,
  LanProbeAdapter,
  RouteChangeListener,
  EnvelopeOptions,
  BuildParamsContext,
  NavigationAdapter,
  ActionRpcAdapter,
  DataStoreAdapter,
  ActionResult,
  ListDataSource,
} from './core';

// Management Platform
export {
  SchemaManager,
  SchemaDesigner,
  SchemaPreviewEngine,
  BindingTester,
  MockTestRunner,
  OSSPublisher,
  createInMemoryAdapter,
  UITestDiagramGenerator,
} from './management';

export type {
  SchemaStatus,
  ManagedSchema,
  SchemaVersionRecord,
  SchemaTemplate,
  NodeBuilderConfig,
  DesignValidationResult,
  DesignValidationError,
  DesignValidationWarning,
  PreviewConfig,
  PreviewSnapshot,
  BindingTestCase,
  BindingTestResult,
  UnresolvedBinding,
  BindingAssertion,
  MockDataSource,
  MockTestScenario,
  MockTestResult,
  OSSConfig,
  OSSUploadAdapter,
  OSSUploadResult,
  PublishOptions,
  PublishResult,
  DiagramType,
  DiagramConfig,
  DiagramResult,
} from './management';

// Types
export type {
  ComponentType,
  StyleProps,
  EventBinding,
  ActionDefinition,
  BindingExpression,
  SchemaNode,
  SchemaDocument,
  SchemaMeta,
  DataSourceDeclaration,
  ApiRequest,
  ApiResponse,
  DataContext,
  ShellConfig,
  ShellPageParams,
  ShellLifecycleHooks,
  ShellError,
  RenderNode,
  SignType,
  Envelope,
  ConnectionRoute,
  ConnectionBridgeConfig,
  LanProbeResult,
  RpcRequest,
  RpcResponse,
  ActionType,
  ActionDescriptor,
  MessageCardType,
  MessageCard,
  MessageCardAction,
  ListContainerOutput,
  RenderedCard,
} from './types';
