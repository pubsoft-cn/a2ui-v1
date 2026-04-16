import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataFetcher, type DataHttpAdapter } from '../../src/core/DataFetcher';
import type { ShellConfig, DataSourceDeclaration, ApiResponse } from '../../src/types';

function createConfig(overrides?: Partial<ShellConfig>): ShellConfig {
  return {
    schemaCdnBase: 'https://cdn.example.com',
    apiBase: 'https://api.example.com',
    timeout: 5000,
    headers: { Authorization: 'Bearer token123' },
    debug: false,
    ...overrides,
  };
}

function createMockHttp(
  responses?: Map<string, unknown>
): DataHttpAdapter {
  return {
    request: vi.fn().mockImplementation(async (req) => {
      if (responses) {
        const data = responses.get(req.url);
        if (data !== undefined) {
          return { code: 0, message: 'ok', data } as ApiResponse;
        }
      }
      return { code: 0, message: 'ok', data: { mock: true } } as ApiResponse;
    }),
  };
}

describe('DataFetcher', () => {
  let config: ShellConfig;
  let mockHttp: DataHttpAdapter;
  let fetcher: DataFetcher;

  beforeEach(() => {
    config = createConfig();
    mockHttp = createMockHttp();
    fetcher = new DataFetcher(config, mockHttp);
  });

  describe('assembleRequest', () => {
    it('should assemble a GET request', () => {
      const ds: DataSourceDeclaration = {
        key: 'users',
        api: '/api/users',
        method: 'GET',
        params: { page: 1 },
      };

      const req = fetcher.assembleRequest(ds);
      expect(req.url).toBe('https://api.example.com/api/users');
      expect(req.method).toBe('GET');
      expect(req.params).toEqual({ page: 1 });
      expect(req.headers).toEqual({ Authorization: 'Bearer token123' });
    });

    it('should assemble a POST request', () => {
      const ds: DataSourceDeclaration = {
        key: 'createUser',
        api: '/api/users',
        method: 'POST',
        params: { name: 'John' },
      };

      const req = fetcher.assembleRequest(ds);
      expect(req.method).toBe('POST');
      expect(req.params).toEqual({ name: 'John' });
    });

    it('should resolve :param style route parameters', () => {
      const ds: DataSourceDeclaration = {
        key: 'userDetail',
        api: '/api/users',
        method: 'GET',
        params: { userId: ':id' },
      };

      const req = fetcher.assembleRequest(ds, { id: '42' });
      expect(req.params).toEqual({ userId: '42' });
    });

    it('should resolve {{$route.param}} style placeholders', () => {
      const ds: DataSourceDeclaration = {
        key: 'orderDetail',
        api: '/api/orders',
        method: 'GET',
        params: { orderId: '{{$route.orderId}}' },
      };

      const req = fetcher.assembleRequest(ds, { orderId: 'ORD-001' });
      expect(req.params).toEqual({ orderId: 'ORD-001' });
    });

    it('should handle missing route params gracefully', () => {
      const ds: DataSourceDeclaration = {
        key: 'test',
        api: '/api/test',
        method: 'GET',
        params: { id: ':missing' },
      };

      const req = fetcher.assembleRequest(ds, {});
      expect(req.params).toEqual({ id: ':missing' });
    });

    it('should handle api path without leading slash', () => {
      const ds: DataSourceDeclaration = {
        key: 'test',
        api: 'api/test',
        method: 'GET',
      };

      const req = fetcher.assembleRequest(ds);
      expect(req.url).toBe('https://api.example.com/api/test');
    });
  });

  describe('fetchAll', () => {
    it('should fetch all data sources concurrently', async () => {
      const dataSources: DataSourceDeclaration[] = [
        { key: 'users', api: '/api/users', method: 'GET' },
        { key: 'posts', api: '/api/posts', method: 'GET' },
      ];

      const result = await fetcher.fetchAll(dataSources);

      expect(result['users']).toEqual({ mock: true });
      expect(result['posts']).toEqual({ mock: true });
      expect(mockHttp.request).toHaveBeenCalledTimes(2);
    });

    it('should inject route params into context', async () => {
      const dataSources: DataSourceDeclaration[] = [
        { key: 'data', api: '/api/data', method: 'GET' },
      ];

      const result = await fetcher.fetchAll(dataSources, { id: '42' });

      expect(result['$route']).toEqual({ id: '42' });
    });

    it('should return empty context when no data sources', async () => {
      const result = await fetcher.fetchAll([]);
      expect(result).toEqual({});
    });

    it('should handle partial failures gracefully', async () => {
      const failHttp: DataHttpAdapter = {
        request: vi.fn()
          .mockResolvedValueOnce({ code: 0, message: 'ok', data: { ok: true } })
          .mockRejectedValueOnce(new Error('Network error')),
      };

      const failFetcher = new DataFetcher(config, failHttp);
      const dataSources: DataSourceDeclaration[] = [
        { key: 'good', api: '/api/good', method: 'GET' },
        { key: 'bad', api: '/api/bad', method: 'GET' },
      ];

      const result = await failFetcher.fetchAll(dataSources);
      expect(result['good']).toEqual({ ok: true });
      expect(result['bad']).toBeNull();
    });

    it('should handle API error codes', async () => {
      const errorHttp: DataHttpAdapter = {
        request: vi.fn().mockResolvedValue({
          code: 500,
          message: 'Internal error',
          data: null,
        }),
      };

      const errorFetcher = new DataFetcher(config, errorHttp);
      const dataSources: DataSourceDeclaration[] = [
        { key: 'error', api: '/api/error', method: 'GET' },
      ];

      const result = await errorFetcher.fetchAll(dataSources);
      expect(result['error']).toBeNull();
    });
  });

  describe('caching', () => {
    it('should cache responses based on TTL', async () => {
      const ds: DataSourceDeclaration = {
        key: 'cached',
        api: '/api/cached',
        method: 'GET',
        cacheTTL: 60,
      };

      await fetcher.fetchOne(ds);
      await fetcher.fetchOne(ds);

      expect(mockHttp.request).toHaveBeenCalledTimes(1);
    });

    it('should not cache when cacheTTL is 0', async () => {
      const ds: DataSourceDeclaration = {
        key: 'uncached',
        api: '/api/uncached',
        method: 'GET',
        cacheTTL: 0,
      };

      await fetcher.fetchOne(ds);
      await fetcher.fetchOne(ds);

      expect(mockHttp.request).toHaveBeenCalledTimes(2);
    });

    it('should invalidate specific cache entry', async () => {
      const ds: DataSourceDeclaration = {
        key: 'inv',
        api: '/api/inv',
        method: 'GET',
        cacheTTL: 60,
      };

      await fetcher.fetchOne(ds);
      fetcher.invalidate('inv');
      await fetcher.fetchOne(ds);

      expect(mockHttp.request).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      const ds1: DataSourceDeclaration = {
        key: 'a',
        api: '/api/a',
        method: 'GET',
        cacheTTL: 60,
      };
      const ds2: DataSourceDeclaration = {
        key: 'b',
        api: '/api/b',
        method: 'GET',
        cacheTTL: 60,
      };

      await fetcher.fetchOne(ds1);
      await fetcher.fetchOne(ds2);
      fetcher.clearCache();
      await fetcher.fetchOne(ds1);
      await fetcher.fetchOne(ds2);

      expect(mockHttp.request).toHaveBeenCalledTimes(4);
    });
  });
});
