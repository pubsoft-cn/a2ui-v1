import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2UIShell } from '../../src/core/A2UIShell';
import type { HttpAdapter } from '../../src/core/SchemaLoader';
import type { DataHttpAdapter } from '../../src/core/DataFetcher';
import type { SchemaDocument, ShellConfig, ApiResponse } from '../../src/types';

const testSchema: SchemaDocument = {
  version: 'v1-test',
  meta: { title: 'Test Page' },
  root: {
    id: 'root',
    type: 'view',
    props: {},
    children: [
      {
        id: 'header',
        type: 'text',
        props: { content: 'Welcome, {{userInfo.name}}!' },
      },
      {
        id: 'avatar',
        type: 'image',
        props: { src: '{{userInfo.avatar}}' },
      },
      {
        id: 'item',
        type: 'view',
        props: {},
        repeat: 'listData.items',
        repeatItem: 'item',
        children: [
          {
            id: 'itemTitle',
            type: 'text',
            props: { content: '{{item.title}}' },
          },
        ],
      },
      {
        id: 'adminPanel',
        type: 'view',
        props: {},
        condition: "userInfo.role === 'admin'",
        children: [
          {
            id: 'adminText',
            type: 'text',
            props: { content: 'Admin Panel' },
          },
        ],
      },
    ],
  },
  dataSources: [
    {
      key: 'userInfo',
      api: '/api/user/info',
      method: 'GET',
    },
    {
      key: 'listData',
      api: '/api/list',
      method: 'GET',
      params: { category: ':cat' },
    },
  ],
};

const testUserData = {
  name: 'Alice',
  avatar: 'https://example.com/alice.png',
  role: 'admin',
};

const testListData = {
  items: [
    { title: 'Item 1' },
    { title: 'Item 2' },
    { title: 'Item 3' },
  ],
};

function createConfig(): ShellConfig {
  return {
    schemaCdnBase: 'https://cdn.example.com',
    apiBase: 'https://api.example.com',
    timeout: 5000,
    cacheStrategy: 'memory',
    debug: false,
  };
}

function createMockSchemaHttp(): HttpAdapter {
  return {
    get: vi.fn().mockResolvedValue(testSchema),
  };
}

function createMockDataHttp(): DataHttpAdapter {
  return {
    request: vi.fn().mockImplementation(async (req) => {
      if (req.url.includes('/user/info')) {
        return { code: 0, message: 'ok', data: testUserData } as ApiResponse;
      }
      if (req.url.includes('/list')) {
        return { code: 0, message: 'ok', data: testListData } as ApiResponse;
      }
      return { code: 404, message: 'not found', data: null } as ApiResponse;
    }),
  };
}

describe('A2UIShell', () => {
  let shell: A2UIShell;
  let schemaHttp: HttpAdapter;
  let dataHttp: DataHttpAdapter;

  beforeEach(() => {
    schemaHttp = createMockSchemaHttp();
    dataHttp = createMockDataHttp();
    shell = new A2UIShell(createConfig(), {
      httpAdapter: schemaHttp,
      dataHttpAdapter: dataHttp,
    });
  });

  describe('loadAndRender', () => {
    it('should complete a full render cycle', async () => {
      const result = await shell.loadAndRender({
        pageKey: 'home',
        version: 'v1-test',
        params: { cat: 'tech' },
      });

      expect(result.schema).toEqual(testSchema);
      expect(result.data['userInfo']).toEqual(testUserData);
      expect(result.data['listData']).toEqual(testListData);

      // Check the output tree
      expect(result.output.type).toBe('view');
      expect(result.output.children).toBeDefined();

      // Check timing
      expect(result.timing.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.timing.schemaLoadTime).toBeGreaterThanOrEqual(0);
      expect(result.timing.dataFetchTime).toBeGreaterThanOrEqual(0);
      expect(result.timing.bindingTime).toBeGreaterThanOrEqual(0);
      expect(result.timing.renderTime).toBeGreaterThanOrEqual(0);
    });

    it('should bind data to schema correctly', async () => {
      const result = await shell.loadAndRender({
        pageKey: 'home',
        params: { cat: 'tech' },
      });

      const children = result.output.children!;

      // Header text should be bound
      expect(children[0].props['content']).toBe('Welcome, Alice!');

      // Avatar should be bound
      expect(children[1].props['src']).toBe('https://example.com/alice.png');
    });

    it('should expand repeated items', async () => {
      const result = await shell.loadAndRender({
        pageKey: 'home',
        params: { cat: 'tech' },
      });

      const children = result.output.children!;

      // Find the repeated item nodes (they have content matching "Item N")
      const repeatedItems = children.filter(
        (c) =>
          c.type === 'view' &&
          c.children?.some(
            (gc) =>
              gc.type === 'text' &&
              typeof gc.props['content'] === 'string' &&
              gc.props['content'].startsWith('Item ')
          )
      );
      expect(repeatedItems).toHaveLength(3);
      expect(repeatedItems[0].children![0].props['content']).toBe('Item 1');
      expect(repeatedItems[1].children![0].props['content']).toBe('Item 2');
      expect(repeatedItems[2].children![0].props['content']).toBe('Item 3');
    });

    it('should render conditional admin panel for admin user', async () => {
      const result = await shell.loadAndRender({
        pageKey: 'home',
        params: { cat: 'tech' },
      });

      const children = result.output.children!;
      const adminPanel = children.find(
        (c) =>
          c.children?.some((gc) => gc.props['content'] === 'Admin Panel')
      );
      expect(adminPanel).toBeDefined();
    });

    it('should hide conditional panel for non-admin user', async () => {
      const nonAdminDataHttp: DataHttpAdapter = {
        request: vi.fn().mockImplementation(async (req) => {
          if (req.url.includes('/user/info')) {
            return {
              code: 0,
              message: 'ok',
              data: { ...testUserData, role: 'user' },
            } as ApiResponse;
          }
          return { code: 0, message: 'ok', data: testListData } as ApiResponse;
        }),
      };

      const nonAdminShell = new A2UIShell(createConfig(), {
        httpAdapter: schemaHttp,
        dataHttpAdapter: nonAdminDataHttp,
      });

      const result = await nonAdminShell.loadAndRender({
        pageKey: 'home',
        params: { cat: 'tech' },
      });

      const children = result.output.children!;
      const adminPanel = children.find(
        (c) =>
          c.children?.some((gc) => gc.props['content'] === 'Admin Panel')
      );
      expect(adminPanel).toBeUndefined();
    });
  });

  describe('lifecycle hooks', () => {
    it('should call lifecycle hooks in order', async () => {
      const callOrder: string[] = [];

      const hookedShell = new A2UIShell(createConfig(), {
        httpAdapter: schemaHttp,
        dataHttpAdapter: dataHttp,
        hooks: {
          onSchemaLoaded: () => callOrder.push('schemaLoaded'),
          onDataLoaded: () => callOrder.push('dataLoaded'),
          onRenderComplete: () => callOrder.push('renderComplete'),
          onError: () => callOrder.push('error'),
        },
      });

      await hookedShell.loadAndRender({ pageKey: 'home' });

      expect(callOrder).toEqual([
        'schemaLoaded',
        'dataLoaded',
        'renderComplete',
      ]);
    });

    it('should call onError hook on failure', async () => {
      const onError = vi.fn();
      const failHttp: HttpAdapter = {
        get: vi.fn().mockRejectedValue(new Error('CDN down')),
      };

      const failShell = new A2UIShell(createConfig(), {
        httpAdapter: failHttp,
        hooks: { onError },
      });

      await expect(
        failShell.loadAndRender({ pageKey: 'home' })
      ).rejects.toBeDefined();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    it('should dispatch events through the renderer', async () => {
      const handler = vi.fn();
      shell.setEventHandler(handler);

      const result = await shell.loadAndRender({ pageKey: 'home' });

      // The test schema doesn't have events, but verify setup works
      expect(result.output).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      await shell.loadAndRender({ pageKey: 'home' });
      shell.clearAllCaches();

      // Second load should fetch again
      await shell.loadAndRender({ pageKey: 'home' });
      expect(schemaHttp.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('accessor methods', () => {
    it('should expose internal components', () => {
      expect(shell.getSchemaLoader()).toBeDefined();
      expect(shell.getDataFetcher()).toBeDefined();
      expect(shell.getBindingEngine()).toBeDefined();
      expect(shell.getRenderer()).toBeDefined();
    });
  });
});
