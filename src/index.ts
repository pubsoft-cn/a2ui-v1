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
} from './core';

export type {
  HttpAdapter,
  DataHttpAdapter,
  ComponentRenderOutput,
  ComponentDefinition,
  EventHandler,
  ShellRenderResult,
  ShellTiming,
} from './core';

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
} from './types';
