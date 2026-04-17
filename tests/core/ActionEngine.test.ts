import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionEngine, type NavigationAdapter, type ActionRpcAdapter, type DataStoreAdapter } from '../../src/core/ActionEngine';
import type { ActionDescriptor, RpcResponse } from '../../src/types';

function createMockNavigation(): NavigationAdapter {
  return {
    navigateTo: vi.fn(),
  };
}

function createMockRpcAdapter(response?: Partial<RpcResponse>): ActionRpcAdapter {
  return {
    call: vi.fn().mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { result: true },
      route: 'lan',
      ...response,
    } satisfies RpcResponse),
  };
}

function createMockDataStore(): DataStoreAdapter & {
  store: Record<string, unknown>;
  changes: string[];
} {
  const store: Record<string, unknown> = {};
  const changes: string[] = [];

  return {
    store,
    changes,
    getData: vi.fn().mockReturnValue(store),
    setData: vi.fn().mockImplementation((path: string, value: unknown) => {
      store[path] = value;
    }),
    notifyChange: vi.fn().mockImplementation((path: string) => {
      changes.push(path);
    }),
  };
}

describe('ActionEngine', () => {
  let engine: ActionEngine;

  beforeEach(() => {
    engine = new ActionEngine(false);
  });

  describe('updateData', () => {
    it('should set data at the target path', async () => {
      const dataStore = createMockDataStore();
      engine.setDataStore(dataStore);

      const action: ActionDescriptor = {
        type: 'updateData',
        target: 'user.name',
        value: 'Alice',
      };

      const result = await engine.dispatch(action, {});

      expect(result.success).toBe(true);
      expect(result.type).toBe('updateData');
      expect(dataStore.setData).toHaveBeenCalledWith('user.name', 'Alice');
      expect(dataStore.notifyChange).toHaveBeenCalledWith('user.name');
    });

    it('should resolve template values in updateData', async () => {
      const dataStore = createMockDataStore();
      engine.setDataStore(dataStore);

      const action: ActionDescriptor = {
        type: 'updateData',
        target: 'selectedId',
        value: '${context.row.id}',
      };

      const result = await engine.dispatch(action, {
        context: { row: { id: 42 } },
      });

      expect(result.success).toBe(true);
      expect(dataStore.setData).toHaveBeenCalledWith('selectedId', 42);
    });

    it('should fail without target', async () => {
      const dataStore = createMockDataStore();
      engine.setDataStore(dataStore);

      const action: ActionDescriptor = {
        type: 'updateData',
        value: 'test',
      };

      const result = await engine.dispatch(action, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('target');
    });

    it('should fail without data store', async () => {
      const action: ActionDescriptor = {
        type: 'updateData',
        target: 'field',
        value: 'test',
      };

      const result = await engine.dispatch(action, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('DataStore');
    });
  });

  describe('Maps (navigation)', () => {
    it('should navigate to the given URL', async () => {
      const nav = createMockNavigation();
      engine.setNavigationAdapter(nav);

      const action: ActionDescriptor = {
        type: 'Maps',
        url: '/pages/detail?id=42',
      };

      const result = await engine.dispatch(action, {});

      expect(result.success).toBe(true);
      expect(result.type).toBe('Maps');
      expect(nav.navigateTo).toHaveBeenCalledWith('/pages/detail?id=42');
    });

    it('should resolve templates in URL', async () => {
      const nav = createMockNavigation();
      engine.setNavigationAdapter(nav);

      const action: ActionDescriptor = {
        type: 'Maps',
        url: '/pages/detail?id=${context.row.id}',
      };

      const result = await engine.dispatch(action, {
        context: { row: { id: 99 } },
      });

      expect(result.success).toBe(true);
      expect(nav.navigateTo).toHaveBeenCalledWith('/pages/detail?id=99');
    });

    it('should fail without URL', async () => {
      engine.setNavigationAdapter(createMockNavigation());

      const action: ActionDescriptor = { type: 'Maps' };
      const result = await engine.dispatch(action, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('url');
    });

    it('should fail without navigation adapter', async () => {
      const action: ActionDescriptor = {
        type: 'Maps',
        url: '/pages/test',
      };

      const result = await engine.dispatch(action, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('NavigationAdapter');
    });
  });

  describe('rpcCall', () => {
    it('should call RPC with resolved parameters', async () => {
      const rpc = createMockRpcAdapter();
      engine.setRpcAdapter(rpc);

      const action: ActionDescriptor = {
        type: 'rpcCall',
        method: '/api/order/submit',
        body: {
          orderId: '${context.row.id}',
          userId: '${formData.userId}',
        },
      };

      const result = await engine.dispatch(action, {
        context: { row: { id: 'ORD-1' } },
        formData: { userId: 42 },
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe('rpcCall');
      expect(rpc.call).toHaveBeenCalledWith('/api/order/submit', {
        orderId: 'ORD-1',
        userId: 42,
      });
    });

    it('should handle RPC error response', async () => {
      const rpc = createMockRpcAdapter({ code: 500, message: 'Server error' });
      engine.setRpcAdapter(rpc);

      const action: ActionDescriptor = {
        type: 'rpcCall',
        method: '/api/fail',
      };

      const result = await engine.dispatch(action, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle RPC network error', async () => {
      const rpc: ActionRpcAdapter = {
        call: vi.fn().mockRejectedValue(new Error('Network timeout')),
      };
      engine.setRpcAdapter(rpc);

      const action: ActionDescriptor = {
        type: 'rpcCall',
        method: '/api/timeout',
      };

      const result = await engine.dispatch(action, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should execute onSuccess callback', async () => {
      const rpc = createMockRpcAdapter({ data: { newStatus: 'confirmed' } });
      const dataStore = createMockDataStore();
      engine.setRpcAdapter(rpc);
      engine.setDataStore(dataStore);

      const action: ActionDescriptor = {
        type: 'rpcCall',
        method: '/api/confirm',
        body: { id: '${context.row.id}' },
        onSuccess: {
          type: 'updateData',
          target: 'order.status',
          value: '${response.newStatus}',
        },
      };

      const result = await engine.dispatch(action, {
        context: { row: { id: 1 } },
      });

      expect(result.success).toBe(true);
      expect(dataStore.setData).toHaveBeenCalledWith('order.status', 'confirmed');
    });

    it('should call with empty params when body is not provided', async () => {
      const rpc = createMockRpcAdapter();
      engine.setRpcAdapter(rpc);

      const action: ActionDescriptor = {
        type: 'rpcCall',
        method: '/api/ping',
      };

      await engine.dispatch(action, {});
      expect(rpc.call).toHaveBeenCalledWith('/api/ping', {});
    });

    it('should fail without method', async () => {
      engine.setRpcAdapter(createMockRpcAdapter());

      const action: ActionDescriptor = { type: 'rpcCall' };
      const result = await engine.dispatch(action, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('method');
    });

    it('should fail without RPC adapter', async () => {
      const action: ActionDescriptor = {
        type: 'rpcCall',
        method: '/api/test',
      };

      const result = await engine.dispatch(action, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('RPC adapter');
    });
  });

  describe('unknown action type', () => {
    it('should return failure for unknown action types', async () => {
      const result = await engine.dispatch(
        { type: 'unknown' as ActionDescriptor['type'] },
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action type');
    });
  });
});
