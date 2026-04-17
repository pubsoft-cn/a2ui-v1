/**
 * ActionEngine - Schema-Driven Action Dispatcher
 *
 * Handles three action types defined in schemas:
 * - updateData: Partial data refresh (set a value in the data context)
 * - Maps: Page navigation (mini-program page jump)
 * - rpcCall: Trigger an RPC request via ConnectionBridge or fallback HTTP
 *
 * Uses BuildParams to resolve ${formData.xxx} and ${context.row.xxx}
 * in action parameter templates.
 */

import type { ActionDescriptor, RpcResponse } from '../types';
import { BuildParams, type BuildParamsContext } from './BuildParams';

/** Navigation adapter for Maps actions (page jumps) */
export interface NavigationAdapter {
  navigateTo(url: string): void;
}

/** RPC adapter for rpcCall actions */
export interface ActionRpcAdapter {
  call<T = unknown>(method: string, params: Record<string, unknown>): Promise<RpcResponse<T>>;
}

/** Data store adapter for updateData actions */
export interface DataStoreAdapter {
  /** Get the current data context */
  getData(): Record<string, unknown>;
  /** Set a value at the given path in the data context */
  setData(path: string, value: unknown): void;
  /** Notify listeners that data has changed */
  notifyChange(path: string): void;
}

/** Action execution result */
export interface ActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Action type that was executed */
  type: string;
  /** Result data (for rpcCall) */
  data?: unknown;
  /** Error message (on failure) */
  error?: string;
}

export class ActionEngine {
  private navigation: NavigationAdapter | null = null;
  private rpcAdapter: ActionRpcAdapter | null = null;
  private dataStore: DataStoreAdapter | null = null;
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  /**
   * Set the navigation adapter for Maps actions.
   */
  setNavigationAdapter(adapter: NavigationAdapter): void {
    this.navigation = adapter;
  }

  /**
   * Set the RPC adapter for rpcCall actions.
   */
  setRpcAdapter(adapter: ActionRpcAdapter): void {
    this.rpcAdapter = adapter;
  }

  /**
   * Set the data store adapter for updateData actions.
   */
  setDataStore(adapter: DataStoreAdapter): void {
    this.dataStore = adapter;
  }

  /**
   * Dispatch an action with the given context.
   */
  async dispatch(
    action: ActionDescriptor,
    context: BuildParamsContext
  ): Promise<ActionResult> {
    this.log(`Dispatching action: ${action.type}`);

    try {
      switch (action.type) {
        case 'updateData':
          return this.handleUpdateData(action, context);
        case 'Maps':
          return this.handleMaps(action, context);
        case 'rpcCall':
          return await this.handleRpcCall(action, context);
        default:
          return {
            success: false,
            type: action.type,
            error: `Unknown action type: ${action.type}`,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Action failed: ${message}`);
      return { success: false, type: action.type, error: message };
    }
  }

  /**
   * Handle updateData action: set a value in the data store.
   */
  private handleUpdateData(
    action: ActionDescriptor,
    context: BuildParamsContext
  ): ActionResult {
    if (!action.target) {
      return {
        success: false,
        type: 'updateData',
        error: 'updateData action requires a "target" field path',
      };
    }

    if (!this.dataStore) {
      return {
        success: false,
        type: 'updateData',
        error: 'No DataStore adapter configured',
      };
    }

    const resolvedValue = BuildParams.resolveValue(action.value, context);
    this.dataStore.setData(action.target, resolvedValue);
    this.dataStore.notifyChange(action.target);

    this.log(`updateData: ${action.target} = ${JSON.stringify(resolvedValue)}`);
    return { success: true, type: 'updateData', data: resolvedValue };
  }

  /**
   * Handle Maps action: navigate to a URL.
   */
  private handleMaps(
    action: ActionDescriptor,
    context: BuildParamsContext
  ): ActionResult {
    if (!action.url) {
      return {
        success: false,
        type: 'Maps',
        error: 'Maps action requires a "url" field',
      };
    }

    if (!this.navigation) {
      return {
        success: false,
        type: 'Maps',
        error: 'No NavigationAdapter configured',
      };
    }

    // Resolve any template expressions in the URL
    const resolvedUrl = BuildParams.resolveString(action.url, context);
    const url = typeof resolvedUrl === 'string' ? resolvedUrl : String(resolvedUrl);

    this.navigation.navigateTo(url);
    this.log(`Maps: navigating to ${url}`);
    return { success: true, type: 'Maps', data: url };
  }

  /**
   * Handle rpcCall action: invoke RPC with resolved parameters.
   */
  private async handleRpcCall(
    action: ActionDescriptor,
    context: BuildParamsContext
  ): Promise<ActionResult> {
    if (!action.method) {
      return {
        success: false,
        type: 'rpcCall',
        error: 'rpcCall action requires a "method" field',
      };
    }

    if (!this.rpcAdapter) {
      return {
        success: false,
        type: 'rpcCall',
        error: 'No RPC adapter configured',
      };
    }

    // Resolve body parameters using BuildParams
    const resolvedParams = action.body
      ? BuildParams.resolve(action.body, context)
      : {};

    this.log(`rpcCall: ${action.method} with ${JSON.stringify(resolvedParams)}`);

    const response = await this.rpcAdapter.call(action.method, resolvedParams);

    if (response.code !== 0 && response.code !== 200) {
      return {
        success: false,
        type: 'rpcCall',
        error: `RPC error: code=${response.code}, message=${response.message}`,
        data: response.data,
      };
    }

    // Execute onSuccess callback if defined
    if (action.onSuccess) {
      const successContext: BuildParamsContext = {
        ...context,
        response: response.data as Record<string, unknown>,
      };
      await this.dispatch(action.onSuccess, successContext);
    }

    return { success: true, type: 'rpcCall', data: response.data };
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[A2UI ActionEngine] ${message}`);
    }
  }
}
