/**
 * DataFetcher - Channel 2 of the Dual-Fetch Architecture
 *
 * Responsible for assembling ApiRequest objects from DataSourceDeclarations,
 * executing them, and returning the aggregated DataContext.
 */

import type {
  ApiRequest,
  ApiResponse,
  DataContext,
  DataSourceDeclaration,
  ShellConfig,
} from '../types';

/** Network adapter interface for data API requests */
export interface DataHttpAdapter {
  request<T>(req: ApiRequest): Promise<ApiResponse<T>>;
}

/**
 * Default HTTP adapter using fetch API.
 * Should be replaced with uni.request / wx.request in mini-program environments.
 */
export const defaultDataHttpAdapter: DataHttpAdapter = {
  async request<T>(req: ApiRequest): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = req.timeout
      ? setTimeout(() => controller.abort(), req.timeout)
      : undefined;

    try {
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
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: HTTP ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as ApiResponse<T>;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  },
};

/** Response cache entry */
interface DataCacheEntry {
  data: unknown;
  expiry: number;
}

export class DataFetcher {
  private config: ShellConfig;
  private http: DataHttpAdapter;
  private cache: Map<string, DataCacheEntry> = new Map();

  constructor(config: ShellConfig, http?: DataHttpAdapter) {
    this.config = config;
    this.http = http ?? defaultDataHttpAdapter;
  }

  /**
   * Fetch all declared data sources and return an aggregated DataContext.
   * Executes all requests concurrently for performance.
   */
  async fetchAll(
    dataSources: DataSourceDeclaration[],
    routeParams?: Record<string, string>
  ): Promise<DataContext> {
    if (!dataSources || dataSources.length === 0) {
      return {};
    }

    const results = await Promise.allSettled(
      dataSources.map((ds) => this.fetchOne(ds, routeParams))
    );

    const context: DataContext = {};

    results.forEach((result, index) => {
      const ds = dataSources[index];
      if (result.status === 'fulfilled') {
        context[ds.key] = result.value;
      } else {
        this.log(`Data fetch failed for "${ds.key}": ${result.reason}`);
        context[ds.key] = null;
      }
    });

    // Inject route params into context
    if (routeParams) {
      context['$route'] = routeParams;
    }

    return context;
  }

  /**
   * Fetch a single data source.
   */
  async fetchOne(
    ds: DataSourceDeclaration,
    routeParams?: Record<string, string>
  ): Promise<unknown> {
    // Check cache
    if (ds.cacheTTL && ds.cacheTTL > 0) {
      const cached = this.cache.get(ds.key);
      if (cached && Date.now() < cached.expiry) {
        this.log(`Data cache hit: ${ds.key}`);
        return cached.data;
      }
    }

    const request = this.assembleRequest(ds, routeParams);
    this.log(`Fetching data: ${ds.key} -> ${request.method} ${request.url}`);

    const response = await this.http.request(request);

    if (response.code !== 0 && response.code !== 200) {
      throw new Error(
        `API error for "${ds.key}": code=${response.code}, message=${response.message}`
      );
    }

    // Store in cache if TTL is configured
    if (ds.cacheTTL && ds.cacheTTL > 0) {
      this.cache.set(ds.key, {
        data: response.data,
        expiry: Date.now() + ds.cacheTTL * 1000,
      });
    }

    return response.data;
  }

  /**
   * Assemble an ApiRequest from a DataSourceDeclaration.
   * Resolves route parameter placeholders in the params.
   */
  assembleRequest(
    ds: DataSourceDeclaration,
    routeParams?: Record<string, string>
  ): ApiRequest {
    const baseUrl = this.config.apiBase.replace(/\/+$/, '');
    const apiPath = ds.api.startsWith('/') ? ds.api : `/${ds.api}`;

    const resolvedParams = ds.params
      ? this.resolveParams(ds.params, routeParams)
      : undefined;

    return {
      url: `${baseUrl}${apiPath}`,
      method: ds.method,
      headers: { ...this.config.headers },
      params: resolvedParams,
      timeout: this.config.timeout ?? 10000,
    };
  }

  /**
   * Invalidate cached data for a specific key.
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all data cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Resolve parameter placeholders like ":id" or "{{$route.id}}"
   * with actual values from route params.
   */
  private resolveParams(
    params: Record<string, unknown>,
    routeParams?: Record<string, string>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveParamValue(value, routeParams);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private resolveParamValue(
    value: string,
    routeParams?: Record<string, string>
  ): string {
    if (!routeParams) return value;

    // Resolve ":paramName" style placeholders
    let resolved = value.replace(/:(\w+)/g, (_, name: string) => {
      return routeParams[name] ?? `:${name}`;
    });

    // Resolve "{{$route.paramName}}" style placeholders
    resolved = resolved.replace(/\{\{\s*\$route\.(\w+)\s*\}\}/g, (_, name: string) => {
      return routeParams[name] ?? '';
    });

    return resolved;
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[A2UI DataFetcher] ${message}`);
    }
  }
}
