import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionBridge, type LanProbeAdapter } from '../../src/core/ConnectionBridge';
import type { DataHttpAdapter } from '../../src/core/DataFetcher';
import type {
  ConnectionBridgeConfig,
  LanProbeResult,
  ApiResponse,
} from '../../src/types';

function createConfig(overrides?: Partial<ConnectionBridgeConfig>): ConnectionBridgeConfig {
  return {
    publicWssUrl: 'wss://relay.example.com',
    publicApiBase: 'https://api.example.com',
    syncToCloud: false,
    lanGatewayHost: '192.168.1.100',
    lanGatewayPort: 8443,
    lanProbeTimeout: 1000,
    sessionToken: 'test-session',
    hmacSecret: 'test-secret',
    defaultSignType: 'SESSION',
    debug: false,
    ...overrides,
  };
}

function createReachableProbe(): LanProbeAdapter {
  return {
    probe: vi.fn().mockResolvedValue({
      reachable: true,
      host: '192.168.1.100',
      port: 8443,
      latency: 5,
    } satisfies LanProbeResult),
  };
}

function createUnreachableProbe(): LanProbeAdapter {
  return {
    probe: vi.fn().mockResolvedValue({
      reachable: false,
    } satisfies LanProbeResult),
  };
}

function createMockHttp(response?: unknown): DataHttpAdapter {
  return {
    request: vi.fn().mockResolvedValue({
      code: 0,
      message: 'ok',
      data: response ?? { result: true },
    } as ApiResponse),
  };
}

describe('ConnectionBridge', () => {
  describe('initialization', () => {
    it('should use LAN route when gateway is reachable', async () => {
      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: createReachableProbe(),
        httpAdapter: createMockHttp(),
      });

      const route = await bridge.initialize();
      expect(route).toBe('lan');
      expect(bridge.getRoute()).toBe('lan');
    });

    it('should fall back to cloud when gateway is unreachable', async () => {
      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: createUnreachableProbe(),
        httpAdapter: createMockHttp(),
      });

      const route = await bridge.initialize();
      expect(route).toBe('cloud');
      expect(bridge.getRoute()).toBe('cloud');
    });

    it('should use cloud when no LAN host is configured', async () => {
      const bridge = new ConnectionBridge(
        createConfig({ lanGatewayHost: undefined }),
        { httpAdapter: createMockHttp() }
      );

      const route = await bridge.initialize();
      expect(route).toBe('cloud');
    });
  });

  describe('RPC routing', () => {
    it('should route RPC to LAN when connected', async () => {
      const mockHttp = createMockHttp({ value: 42 });
      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: createReachableProbe(),
        httpAdapter: mockHttp,
      });

      await bridge.initialize();

      const response = await bridge.rpc({
        method: '/api/getData',
        params: { id: 1 },
      });

      expect(response.route).toBe('lan');
      expect(response.data).toEqual({ value: 42 });
      expect(mockHttp.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('192.168.1.100'),
        })
      );
    });

    it('should route RPC to cloud when LAN unavailable', async () => {
      const mockHttp = createMockHttp();
      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: createUnreachableProbe(),
        httpAdapter: mockHttp,
      });

      await bridge.initialize();

      const response = await bridge.rpc({
        method: '/api/getData',
        params: { id: 1 },
      });

      expect(response.route).toBe('cloud');
      expect(mockHttp.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('api.example.com'),
        })
      );
    });

    it('should include envelope headers in requests', async () => {
      const mockHttp = createMockHttp();
      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: createReachableProbe(),
        httpAdapter: mockHttp,
      });

      await bridge.initialize();
      await bridge.rpc({ method: '/api/test' });

      expect(mockHttp.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Msg-Id': expect.any(String),
            'X-Timestamp': expect.any(String),
            'X-Sign-Type': 'SESSION',
            'X-Sign': expect.any(String),
          }),
        })
      );
    });
  });

  describe('privacy constraint', () => {
    it('should block data requests to cloud when syncToCloud is false', async () => {
      const bridge = new ConnectionBridge(
        createConfig({ syncToCloud: false }),
        {
          probeAdapter: createUnreachableProbe(),
          httpAdapter: createMockHttp(),
        }
      );

      await bridge.initialize();

      await expect(
        bridge.rpc({
          method: '/api/saveData',
          params: { data: 'sensitive' },
          isDataRequest: true,
        })
      ).rejects.toThrow('syncToCloud is disabled');
    });

    it('should allow data requests to cloud when syncToCloud is true', async () => {
      const bridge = new ConnectionBridge(
        createConfig({ syncToCloud: true }),
        {
          probeAdapter: createUnreachableProbe(),
          httpAdapter: createMockHttp(),
        }
      );

      await bridge.initialize();

      const response = await bridge.rpc({
        method: '/api/saveData',
        params: { data: 'ok' },
        isDataRequest: true,
      });

      expect(response.route).toBe('cloud');
    });

    it('should allow data requests over LAN regardless of syncToCloud', async () => {
      const bridge = new ConnectionBridge(
        createConfig({ syncToCloud: false }),
        {
          probeAdapter: createReachableProbe(),
          httpAdapter: createMockHttp(),
        }
      );

      await bridge.initialize();

      const response = await bridge.rpc({
        method: '/api/saveData',
        params: { data: 'private' },
        isDataRequest: true,
      });

      expect(response.route).toBe('lan');
    });

    it('should allow non-data requests to cloud even when syncToCloud is false', async () => {
      const bridge = new ConnectionBridge(
        createConfig({ syncToCloud: false }),
        {
          probeAdapter: createUnreachableProbe(),
          httpAdapter: createMockHttp(),
        }
      );

      await bridge.initialize();

      const response = await bridge.rpc({
        method: '/api/getSchema',
        isDataRequest: false,
      });

      expect(response.route).toBe('cloud');
    });

    it('canSendData should reflect current state', async () => {
      const bridge = new ConnectionBridge(
        createConfig({ syncToCloud: false }),
        {
          probeAdapter: createUnreachableProbe(),
          httpAdapter: createMockHttp(),
        }
      );

      await bridge.initialize();
      expect(bridge.canSendData()).toBe(false);

      bridge.setSyncToCloud(true);
      expect(bridge.canSendData()).toBe(true);
    });
  });

  describe('failover', () => {
    it('should fall back to cloud when LAN request fails', async () => {
      let callCount = 0;
      const failThenSucceedHttp: DataHttpAdapter = {
        request: vi.fn().mockImplementation(async (req) => {
          callCount++;
          if (req.url.includes('192.168.1.100') && callCount === 1) {
            throw new Error('LAN connection refused');
          }
          return { code: 0, message: 'ok', data: { fallback: true } } as ApiResponse;
        }),
      };

      const bridge = new ConnectionBridge(
        createConfig({ syncToCloud: true }),
        {
          probeAdapter: createReachableProbe(),
          httpAdapter: failThenSucceedHttp,
        }
      );

      await bridge.initialize();

      const response = await bridge.rpc({
        method: '/api/getData',
        isDataRequest: true,
      });

      expect(response.route).toBe('cloud');
      expect(response.data).toEqual({ fallback: true });
    });

    it('should block cloud fallback for data requests when syncToCloud is false', async () => {
      const failHttp: DataHttpAdapter = {
        request: vi.fn().mockRejectedValue(new Error('LAN failed')),
      };

      const bridge = new ConnectionBridge(
        createConfig({ syncToCloud: false }),
        {
          probeAdapter: createReachableProbe(),
          httpAdapter: failHttp,
        }
      );

      await bridge.initialize();

      await expect(
        bridge.rpc({
          method: '/api/saveData',
          isDataRequest: true,
        })
      ).rejects.toThrow('privacy constraint');
    });
  });

  describe('route change listeners', () => {
    it('should notify listeners on route change', async () => {
      const listener = vi.fn();
      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: createReachableProbe(),
        httpAdapter: createMockHttp(),
      });

      bridge.onRouteChange(listener);
      await bridge.initialize();

      // Initial route is 'cloud' -> 'lan'
      expect(listener).toHaveBeenCalledWith('lan');
    });

    it('should allow unsubscribing from route changes', async () => {
      const listener = vi.fn();
      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: createReachableProbe(),
        httpAdapter: createMockHttp(),
      });

      const unsubscribe = bridge.onRouteChange(listener);
      unsubscribe();

      await bridge.initialize();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('reprobing', () => {
    it('should switch to LAN when gateway becomes reachable', async () => {
      let reachable = false;
      const dynamicProbe: LanProbeAdapter = {
        probe: vi.fn().mockImplementation(async () => ({
          reachable,
          host: '192.168.1.100',
          port: 8443,
          latency: 5,
        })),
      };

      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: dynamicProbe,
        httpAdapter: createMockHttp(),
      });

      await bridge.initialize();
      expect(bridge.getRoute()).toBe('cloud');

      reachable = true;
      await bridge.reprobeGateway();
      expect(bridge.getRoute()).toBe('lan');
    });

    it('should switch to cloud when gateway becomes unreachable', async () => {
      let reachable = true;
      const dynamicProbe: LanProbeAdapter = {
        probe: vi.fn().mockImplementation(async () => ({
          reachable,
          host: '192.168.1.100',
          port: 8443,
        })),
      };

      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: dynamicProbe,
        httpAdapter: createMockHttp(),
      });

      await bridge.initialize();
      expect(bridge.getRoute()).toBe('lan');

      reachable = false;
      await bridge.reprobeGateway();
      expect(bridge.getRoute()).toBe('cloud');
    });
  });

  describe('sign type override', () => {
    it('should use per-request sign type override', async () => {
      const mockHttp = createMockHttp();
      const bridge = new ConnectionBridge(
        createConfig({ defaultSignType: 'SESSION' }),
        {
          probeAdapter: createReachableProbe(),
          httpAdapter: mockHttp,
        }
      );

      await bridge.initialize();
      await bridge.rpc({ method: '/api/test', signType: 'HMAC' });

      expect(mockHttp.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Sign-Type': 'HMAC',
          }),
        })
      );
    });
  });

  describe('destroy', () => {
    it('should clean up resources on destroy', async () => {
      const bridge = new ConnectionBridge(createConfig(), {
        probeAdapter: createReachableProbe(),
        httpAdapter: createMockHttp(),
      });

      await bridge.initialize();
      bridge.startPeriodicProbe(1000);
      bridge.destroy();

      // No error should occur after destroy
      expect(bridge.getRoute()).toBe('lan');
    });
  });

  describe('getEnvelopeProtocol', () => {
    it('should expose the envelope protocol instance', () => {
      const bridge = new ConnectionBridge(createConfig(), {
        httpAdapter: createMockHttp(),
      });

      expect(bridge.getEnvelopeProtocol()).toBeDefined();
    });
  });
});
