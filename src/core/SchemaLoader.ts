/**
 * SchemaLoader - Channel 1 of the Dual-Fetch Architecture
 *
 * Responsible for loading Schema (JSON configuration) from CDN/Redis
 * with version-hash based cache control.
 */

import type { SchemaDocument, ShellConfig } from '../types';

/** In-memory cache entry */
interface CacheEntry {
  schema: SchemaDocument;
  version: string;
  timestamp: number;
}

/** Network adapter interface for cross-platform HTTP requests */
export interface HttpAdapter {
  get<T>(url: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<T>;
}

/**
 * Default HTTP adapter using fetch API.
 * In Uni-app / mini-program environments, this should be replaced
 * with uni.request or wx.request adapter.
 */
export const defaultHttpAdapter: HttpAdapter = {
  async get<T>(url: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<T> {
    const controller = new AbortController();
    const timeoutId = options?.timeout
      ? setTimeout(() => controller.abort(), options.timeout)
      : undefined;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: options?.headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Schema fetch failed: HTTP ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  },
};

export class SchemaLoader {
  private config: ShellConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private http: HttpAdapter;
  private inflightRequests: Map<string, Promise<SchemaDocument>> = new Map();

  constructor(config: ShellConfig, http?: HttpAdapter) {
    this.config = config;
    this.http = http ?? defaultHttpAdapter;
  }

  /**
   * Load a schema by page key with optional version hash.
   * Implements cache-first strategy with deduplication of in-flight requests.
   */
  async load(pageKey: string, version?: string): Promise<SchemaDocument> {
    const cacheKey = this.buildCacheKey(pageKey, version);

    // 1. Check memory cache
    if (this.config.cacheStrategy !== 'none') {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.log(`Schema cache hit: ${cacheKey}`);
        return cached.schema;
      }
    }

    // 2. Deduplicate concurrent requests for the same schema
    const inflight = this.inflightRequests.get(cacheKey);
    if (inflight) {
      this.log(`Schema request dedup: ${cacheKey}`);
      return inflight;
    }

    // 3. Fetch from CDN
    const fetchPromise = this.fetchSchema(pageKey, version);
    this.inflightRequests.set(cacheKey, fetchPromise);

    try {
      const schema = await fetchPromise;

      // 4. Store in cache
      if (this.config.cacheStrategy !== 'none') {
        this.cache.set(cacheKey, {
          schema,
          version: schema.version,
          timestamp: Date.now(),
        });
      }

      return schema;
    } finally {
      this.inflightRequests.delete(cacheKey);
    }
  }

  /**
   * Invalidate cached schema for a given page key.
   */
  invalidate(pageKey: string, version?: string): void {
    const cacheKey = this.buildCacheKey(pageKey, version);
    this.cache.delete(cacheKey);
    this.log(`Schema cache invalidated: ${cacheKey}`);
  }

  /**
   * Clear all cached schemas.
   */
  clearCache(): void {
    this.cache.clear();
    this.log('Schema cache cleared');
  }

  /**
   * Build the CDN URL for a schema.
   */
  buildUrl(pageKey: string, version?: string): string {
    const base = this.config.schemaCdnBase.replace(/\/+$/, '');
    const path = `${base}/schemas/${encodeURIComponent(pageKey)}.json`;
    return version ? `${path}?v=${encodeURIComponent(version)}` : path;
  }

  private buildCacheKey(pageKey: string, version?: string): string {
    return version ? `${pageKey}@${version}` : pageKey;
  }

  private async fetchSchema(pageKey: string, version?: string): Promise<SchemaDocument> {
    const url = this.buildUrl(pageKey, version);
    this.log(`Fetching schema: ${url}`);

    try {
      const schema = await this.http.get<SchemaDocument>(url, {
        headers: this.config.headers,
        timeout: this.config.timeout ?? 10000,
      });

      this.validateSchema(schema);
      return schema;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`SchemaLoader: Failed to load "${pageKey}" - ${message}`);
    }
  }

  /**
   * Basic schema validation to ensure required fields are present.
   */
  private validateSchema(schema: SchemaDocument): void {
    if (!schema || typeof schema !== 'object') {
      throw new Error('SchemaLoader: Invalid schema - not an object');
    }
    if (!schema.version || typeof schema.version !== 'string') {
      throw new Error('SchemaLoader: Invalid schema - missing or invalid "version"');
    }
    if (!schema.root || typeof schema.root !== 'object') {
      throw new Error('SchemaLoader: Invalid schema - missing or invalid "root"');
    }
    if (!schema.root.id || !schema.root.type) {
      throw new Error('SchemaLoader: Invalid schema - root node missing "id" or "type"');
    }
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[A2UI SchemaLoader] ${message}`);
    }
  }
}
