/**
 * ConnectionBridge - Hybrid Path Connection Manager
 *
 * Manages dual-channel communication:
 * 1. LAN private gateway (priority) - via mDNS/UDP probe
 * 2. Public WSS relay (fallback) - via cloud domain
 *
 * Privacy Constraint: Unless `syncToCloud` is true, all business data
 * stays in memory/localStorage and is never sent to public endpoints.
 */

import type {
  ConnectionBridgeConfig,
  ConnectionRoute,
  LanProbeResult,
  RpcRequest,
  RpcResponse,
  SignType,
  ApiRequest,
  ApiResponse,
} from '../types';
import { EnvelopeProtocol } from './EnvelopeProtocol';
import type { DataHttpAdapter } from './DataFetcher';

/** Network probe adapter for LAN gateway discovery */
export interface LanProbeAdapter {
  /**
   * Probe the LAN gateway at the given host:port.
   * Returns probe result indicating reachability.
   */
  probe(host: string, port: number, timeout: number): Promise<LanProbeResult>;
}

/** Default no-op probe adapter (always returns unreachable) */
const defaultProbeAdapter: LanProbeAdapter = {
  async probe(): Promise<LanProbeResult> {
    return { reachable: false };
  },
};

/** Route change event listener */
export type RouteChangeListener = (route: ConnectionRoute) => void;

export class ConnectionBridge {
  private config: ConnectionBridgeConfig;
  private currentRoute: ConnectionRoute = 'cloud';
  private lanHost: string | undefined;
  private lanPort: number | undefined;
  private probeAdapter: LanProbeAdapter;
  private httpAdapter: DataHttpAdapter;
  private envelope: EnvelopeProtocol;
  private routeListeners: RouteChangeListener[] = [];
  private probeIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: ConnectionBridgeConfig,
    options?: {
      probeAdapter?: LanProbeAdapter;
      httpAdapter?: DataHttpAdapter;
    }
  ) {
    this.config = config;
    this.probeAdapter = options?.probeAdapter ?? defaultProbeAdapter;
    this.httpAdapter = options?.httpAdapter ?? this.createDefaultHttpAdapter();
    this.envelope = new EnvelopeProtocol({
      sessionToken: config.sessionToken,
      hmacSecret: config.hmacSecret,
    });

    // Pre-configure LAN host if provided
    if (config.lanGatewayHost) {
      this.lanHost = config.lanGatewayHost;
      this.lanPort = config.lanGatewayPort ?? 8443;
    }
  }

  /**
   * Initialize the bridge: probe LAN gateway and determine initial route.
   */
  async initialize(): Promise<ConnectionRoute> {
    if (this.lanHost) {
      const probeResult = await this.probeLanGateway();
      if (probeResult.reachable) {
        this.setRoute('lan');
        this.lanHost = probeResult.host ?? this.lanHost;
        this.lanPort = probeResult.port ?? this.lanPort;
        this.log(`LAN gateway found: ${this.lanHost}:${this.lanPort} (${probeResult.latency}ms)`);
      } else {
        this.setRoute('cloud');
        this.log('LAN gateway unreachable, using public cloud');
      }
    } else {
      this.setRoute('cloud');
      this.log('No LAN gateway configured, using public cloud');
    }

    return this.currentRoute;
  }

  /**
   * Execute an RPC request through the appropriate channel.
   * Enforces the privacy constraint: data-bearing requests are blocked
   * from public cloud unless syncToCloud is true.
   */
  async rpc<T = unknown>(request: RpcRequest): Promise<RpcResponse<T>> {
    const route = this.currentRoute;

    // Privacy constraint enforcement
    if (route === 'cloud' && request.isDataRequest && !this.config.syncToCloud) {
      throw new Error(
        'ConnectionBridge: Data request blocked - syncToCloud is disabled ' +
        'and no LAN gateway is available. Business data cannot be sent to public cloud.'
      );
    }

    const signType = request.signType ?? this.config.defaultSignType ?? 'SESSION';
    const envelope = this.envelope.seal(
      { method: request.method, params: request.params ?? {} },
      signType
    );

    const apiRequest = this.buildApiRequest(request, route, envelope);

    try {
      const response = await this.httpAdapter.request<T>(apiRequest);
      return {
        code: response.code,
        message: response.message,
        data: response.data,
        route,
      };
    } catch (error) {
      // If LAN fails, attempt fallback to cloud (if allowed)
      if (route === 'lan') {
        this.log(`LAN request failed, attempting cloud fallback: ${String(error)}`);

        if (request.isDataRequest && !this.config.syncToCloud) {
          throw new Error(
            'ConnectionBridge: LAN request failed and cloud fallback blocked by privacy constraint.'
          );
        }

        this.setRoute('cloud');
        const fallbackRequest = this.buildApiRequest(request, 'cloud', envelope);

        const fallbackResponse = await this.httpAdapter.request<T>(fallbackRequest);
        return {
          code: fallbackResponse.code,
          message: fallbackResponse.message,
          data: fallbackResponse.data,
          route: 'cloud',
        };
      }

      throw error;
    }
  }

  /**
   * Get the current active route.
   */
  getRoute(): ConnectionRoute {
    return this.currentRoute;
  }

  /**
   * Check if data can be sent to the current route.
   */
  canSendData(): boolean {
    return this.currentRoute === 'lan' || this.config.syncToCloud;
  }

  /**
   * Register a listener for route changes.
   */
  onRouteChange(listener: RouteChangeListener): () => void {
    this.routeListeners.push(listener);
    return () => {
      this.routeListeners = this.routeListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Re-probe the LAN gateway and update route if needed.
   */
  async reprobeGateway(): Promise<ConnectionRoute> {
    if (!this.lanHost) return this.currentRoute;

    const result = await this.probeLanGateway();
    if (result.reachable && this.currentRoute !== 'lan') {
      this.setRoute('lan');
      this.log('LAN gateway recovered, switching to LAN');
    } else if (!result.reachable && this.currentRoute !== 'cloud') {
      this.setRoute('cloud');
      this.log('LAN gateway lost, switching to cloud');
    }

    return this.currentRoute;
  }

  /**
   * Start periodic LAN gateway probing.
   */
  startPeriodicProbe(intervalMs = 30000): void {
    this.stopPeriodicProbe();
    this.probeIntervalId = setInterval(() => {
      void this.reprobeGateway();
    }, intervalMs);
  }

  /**
   * Stop periodic LAN gateway probing.
   */
  stopPeriodicProbe(): void {
    if (this.probeIntervalId !== null) {
      clearInterval(this.probeIntervalId);
      this.probeIntervalId = null;
    }
  }

  /**
   * Update the syncToCloud flag at runtime.
   */
  setSyncToCloud(enabled: boolean): void {
    this.config.syncToCloud = enabled;
    this.log(`syncToCloud updated: ${enabled}`);
  }

  /**
   * Get the EnvelopeProtocol instance for advanced usage.
   */
  getEnvelopeProtocol(): EnvelopeProtocol {
    return this.envelope;
  }

  /**
   * Destroy the bridge and clean up resources.
   */
  destroy(): void {
    this.stopPeriodicProbe();
    this.routeListeners = [];
  }

  // ── Private Methods ──────────────────────────────────────────

  private async probeLanGateway(): Promise<LanProbeResult> {
    const host = this.lanHost ?? '';
    const port = this.lanPort ?? 8443;
    const timeout = this.config.lanProbeTimeout ?? 3000;

    return this.probeAdapter.probe(host, port, timeout);
  }

  private buildApiRequest(
    request: RpcRequest,
    route: ConnectionRoute,
    envelope: { msgId: string; timestamp: number; signType: string; sign: string }
  ): ApiRequest {
    const baseUrl =
      route === 'lan'
        ? `https://${this.lanHost}:${this.lanPort}`
        : this.config.publicApiBase.replace(/\/+$/, '');

    const apiPath = request.method.startsWith('/')
      ? request.method
      : `/${request.method}`;

    return {
      url: `${baseUrl}${apiPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Msg-Id': envelope.msgId,
        'X-Timestamp': String(envelope.timestamp),
        'X-Sign-Type': envelope.signType,
        'X-Sign': envelope.sign,
      },
      params: request.params,
    };
  }

  private setRoute(route: ConnectionRoute): void {
    const prev = this.currentRoute;
    this.currentRoute = route;
    if (prev !== route) {
      for (const listener of this.routeListeners) {
        listener(route);
      }
    }
  }

  private createDefaultHttpAdapter(): DataHttpAdapter {
    return {
      async request<T>(req: ApiRequest): Promise<ApiResponse<T>> {
        let url = req.url;
        let body: string | undefined;

        if (req.method === 'GET' && req.params) {
          const qs = new URLSearchParams(
            Object.entries(req.params).map(([k, v]) => [k, String(v)])
          ).toString();
          url = qs ? `${url}?${qs}` : url;
        } else if (req.params) {
          body = JSON.stringify(req.params);
        }

        const response = await fetch(url, {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            ...req.headers,
          },
          body,
        });

        if (!response.ok) {
          throw new Error(`ConnectionBridge: HTTP ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as ApiResponse<T>;
      },
    };
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[A2UI ConnectionBridge] ${message}`);
    }
  }
}
