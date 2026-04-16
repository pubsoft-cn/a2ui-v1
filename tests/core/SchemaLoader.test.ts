import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaLoader, type HttpAdapter } from '../../src/core/SchemaLoader';
import type { SchemaDocument, ShellConfig } from '../../src/types';

const validSchema: SchemaDocument = {
  version: 'v1-abc123',
  meta: { title: 'Test Page' },
  root: {
    id: 'root',
    type: 'view',
    props: {},
    children: [
      {
        id: 'title',
        type: 'text',
        props: { content: '{{pageTitle}}' },
      },
    ],
  },
  dataSources: [
    {
      key: 'userInfo',
      api: '/api/user/info',
      method: 'GET',
    },
  ],
};

function createConfig(overrides?: Partial<ShellConfig>): ShellConfig {
  return {
    schemaCdnBase: 'https://cdn.example.com',
    apiBase: 'https://api.example.com',
    timeout: 5000,
    cacheStrategy: 'memory',
    debug: false,
    ...overrides,
  };
}

function createMockHttp(response?: SchemaDocument): HttpAdapter {
  return {
    get: vi.fn().mockResolvedValue(response ?? validSchema),
  };
}

describe('SchemaLoader', () => {
  let config: ShellConfig;
  let mockHttp: HttpAdapter;
  let loader: SchemaLoader;

  beforeEach(() => {
    config = createConfig();
    mockHttp = createMockHttp();
    loader = new SchemaLoader(config, mockHttp);
  });

  describe('buildUrl', () => {
    it('should build URL without version', () => {
      const url = loader.buildUrl('home');
      expect(url).toBe('https://cdn.example.com/schemas/home.json');
    });

    it('should build URL with version hash', () => {
      const url = loader.buildUrl('home', 'abc123');
      expect(url).toBe('https://cdn.example.com/schemas/home.json?v=abc123');
    });

    it('should encode page key', () => {
      const url = loader.buildUrl('pages/user-profile');
      expect(url).toBe(
        'https://cdn.example.com/schemas/pages%2Fuser-profile.json'
      );
    });

    it('should strip trailing slashes from base URL', () => {
      const loaderWithSlash = new SchemaLoader(
        createConfig({ schemaCdnBase: 'https://cdn.example.com/' }),
        mockHttp
      );
      const url = loaderWithSlash.buildUrl('home');
      expect(url).toBe('https://cdn.example.com/schemas/home.json');
    });
  });

  describe('load', () => {
    it('should fetch schema from CDN', async () => {
      const schema = await loader.load('home');
      expect(schema).toEqual(validSchema);
      expect(mockHttp.get).toHaveBeenCalledTimes(1);
    });

    it('should pass version as query parameter', async () => {
      await loader.load('home', 'v2-xyz');
      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://cdn.example.com/schemas/home.json?v=v2-xyz',
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('should cache schema on subsequent calls', async () => {
      await loader.load('home');
      await loader.load('home');
      expect(mockHttp.get).toHaveBeenCalledTimes(1);
    });

    it('should cache different versions separately', async () => {
      await loader.load('home', 'v1');
      await loader.load('home', 'v2');
      expect(mockHttp.get).toHaveBeenCalledTimes(2);
    });

    it('should skip cache when cacheStrategy is "none"', async () => {
      const noCacheLoader = new SchemaLoader(
        createConfig({ cacheStrategy: 'none' }),
        mockHttp
      );
      await noCacheLoader.load('home');
      await noCacheLoader.load('home');
      expect(mockHttp.get).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate concurrent requests', async () => {
      const [s1, s2] = await Promise.all([
        loader.load('home'),
        loader.load('home'),
      ]);
      expect(s1).toEqual(s2);
      // Only one actual HTTP call should be made
      expect(mockHttp.get).toHaveBeenCalledTimes(1);
    });

    it('should throw on invalid schema (missing version)', async () => {
      const badHttp = createMockHttp({ root: { id: 'r', type: 'view', props: {} } } as unknown as SchemaDocument);
      const badLoader = new SchemaLoader(config, badHttp);
      await expect(badLoader.load('bad')).rejects.toThrow('missing or invalid "version"');
    });

    it('should throw on invalid schema (missing root)', async () => {
      const badHttp = createMockHttp({ version: 'v1' } as unknown as SchemaDocument);
      const badLoader = new SchemaLoader(config, badHttp);
      await expect(badLoader.load('bad')).rejects.toThrow('missing or invalid "root"');
    });

    it('should throw on HTTP error', async () => {
      const errorHttp: HttpAdapter = {
        get: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      const errorLoader = new SchemaLoader(config, errorHttp);
      await expect(errorLoader.load('fail')).rejects.toThrow('Network error');
    });
  });

  describe('invalidate', () => {
    it('should remove cached schema', async () => {
      await loader.load('home');
      loader.invalidate('home');
      await loader.load('home');
      expect(mockHttp.get).toHaveBeenCalledTimes(2);
    });

    it('should invalidate specific version', async () => {
      await loader.load('home', 'v1');
      loader.invalidate('home', 'v1');
      await loader.load('home', 'v1');
      expect(mockHttp.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached schemas', async () => {
      await loader.load('home');
      await loader.load('profile');
      loader.clearCache();
      await loader.load('home');
      await loader.load('profile');
      expect(mockHttp.get).toHaveBeenCalledTimes(4);
    });
  });
});
