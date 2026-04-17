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

// ─── ConnectionBridge Types ────────────────────────────────────

/** Sign type for the envelope protocol */
export type SignType = 'SESSION' | 'HMAC' | 'MD5';

/** Envelope protocol message wrapper */
export interface Envelope<T = unknown> {
  /** Unique message ID */
  msgId: string;
  /** Timestamp (ms) */
  timestamp: number;
  /** Signature type */
  signType: SignType;
  /** Computed signature */
  sign: string;
  /** Business payload */
  body: T;
}

/** Connection route - which channel is active */
export type ConnectionRoute = 'lan' | 'cloud';

/** Configuration for ConnectionBridge */
export interface ConnectionBridgeConfig {
  /** Public WSS relay URL */
  publicWssUrl: string;
  /** Public REST API base URL */
  publicApiBase: string;
  /** LAN gateway probe timeout in ms */
  lanProbeTimeout?: number;
  /** LAN gateway IP/host (discovered or pre-configured) */
  lanGatewayHost?: string;
  /** LAN gateway port */
  lanGatewayPort?: number;
  /** Whether data can be synced to public cloud */
  syncToCloud: boolean;
  /** Session token for SESSION sign type */
  sessionToken?: string;
  /** HMAC secret key */
  hmacSecret?: string;
  /** Default sign type */
  defaultSignType?: SignType;
  /** Enable debug logging */
  debug?: boolean;
}

/** LAN gateway probe result */
export interface LanProbeResult {
  /** Whether the LAN gateway is reachable */
  reachable: boolean;
  /** Discovered host address */
  host?: string;
  /** Discovered port */
  port?: number;
  /** Probe latency in ms */
  latency?: number;
}

/** RPC request for ConnectionBridge */
export interface RpcRequest {
  /** API method/path */
  method: string;
  /** Request parameters */
  params?: Record<string, unknown>;
  /** Override sign type for this request */
  signType?: SignType;
  /** Whether this is a data-bearing request (subject to privacy constraint) */
  isDataRequest?: boolean;
}

/** RPC response from ConnectionBridge */
export interface RpcResponse<T = unknown> {
  /** Business status code */
  code: number;
  /** Response message */
  message: string;
  /** Response data */
  data: T;
  /** Which route was used */
  route: ConnectionRoute;
}

// ─── ActionEngine Types ────────────────────────────────────────

/** Action types supported by the ActionEngine */
export type ActionType = 'updateData' | 'Maps' | 'rpcCall';

/** Action descriptor from schema */
export interface ActionDescriptor {
  /** Action type */
  type: ActionType;
  /** Target field path (for updateData) */
  target?: string;
  /** Value or expression (for updateData) */
  value?: unknown;
  /** Navigation URL (for Maps) */
  url?: string;
  /** RPC method name (for rpcCall) */
  method?: string;
  /** Parameters template with ${formData.xxx} / ${context.row.xxx} syntax */
  body?: Record<string, unknown>;
  /** Callback action to run after rpcCall completes */
  onSuccess?: ActionDescriptor;
}

// ─── ListContainer Types ───────────────────────────────────────

/** Message card type for IM-style list */
export type MessageCardType = 'text' | 'image' | 'action' | 'system' | 'custom';

/** IM-style message card schema */
export interface MessageCard {
  /** Unique card ID */
  id: string;
  /** Card type */
  cardType: MessageCardType;
  /** Sender info */
  sender?: {
    name: string;
    avatar?: string;
  };
  /** Timestamp */
  timestamp?: number;
  /** Card body content */
  content: Record<string, unknown>;
  /** Actions attached to this card */
  actions?: MessageCardAction[];
}

/** Action button on a message card */
export interface MessageCardAction {
  /** Button label */
  label: string;
  /** Action to trigger */
  action: ActionDescriptor;
}

/** ListContainer render output */
export interface ListContainerOutput {
  /** Container ID */
  id: string;
  /** Rendered cards */
  cards: RenderedCard[];
}

/** A rendered card for the view layer */
export interface RenderedCard {
  /** Card ID */
  id: string;
  /** Card type */
  cardType: MessageCardType;
  /** Resolved props for rendering */
  props: Record<string, unknown>;
  /** Resolved action buttons */
  actions?: Array<{
    label: string;
    handler: () => void;
  }>;
}
