/**
 * Full Pipeline Integration Test
 *
 * Demonstrates the complete A2UI workflow:
 * 1. ConnectionBridge routes RPC to LAN/Cloud
 * 2. EnvelopeProtocol signs each request
 * 3. BuildParams resolves action parameters
 * 4. ActionEngine dispatches schema-driven actions
 * 5. ListContainer renders IM-style message cards
 *
 * These tests verify that all modules compose correctly end-to-end.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionBridge, type LanProbeAdapter } from '../../src/core/ConnectionBridge';
import { EnvelopeProtocol } from '../../src/core/EnvelopeProtocol';
import { BuildParams, type BuildParamsContext } from '../../src/core/BuildParams';
import { ActionEngine, type NavigationAdapter, type ActionRpcAdapter, type DataStoreAdapter } from '../../src/core/ActionEngine';
import { ListContainer, type ListDataSource } from '../../src/core/ListContainer';
import type {
  ConnectionBridgeConfig,
  LanProbeResult,
  ApiResponse,
  MessageCard,
  ActionDescriptor,
  RpcResponse,
} from '../../src/types';
import type { DataHttpAdapter } from '../../src/core/DataFetcher';

// ── Shared Helpers ──────────────────────────────────────────────

function createBridgeConfig(overrides?: Partial<ConnectionBridgeConfig>): ConnectionBridgeConfig {
  return {
    publicWssUrl: 'wss://relay.a2ui.example.com',
    publicApiBase: 'https://api.a2ui.example.com',
    syncToCloud: false,
    lanGatewayHost: '192.168.1.200',
    lanGatewayPort: 8443,
    lanProbeTimeout: 500,
    sessionToken: 'integration-test-token',
    hmacSecret: 'integration-hmac-secret',
    defaultSignType: 'SESSION',
    debug: false,
    ...overrides,
  };
}

function createLanProbe(reachable: boolean): LanProbeAdapter {
  return {
    probe: vi.fn().mockResolvedValue({
      reachable,
      host: '192.168.1.200',
      port: 8443,
      latency: reachable ? 3 : undefined,
    } satisfies LanProbeResult),
  };
}

function createHttpAdapter(responses: Record<string, unknown>): DataHttpAdapter {
  return {
    request: vi.fn().mockImplementation(async (req) => {
      const path = new URL(req.url).pathname;
      const data = responses[path] ?? { default: true };
      return { code: 0, message: 'ok', data } as ApiResponse;
    }),
  };
}

// ── Integration Tests ───────────────────────────────────────────

describe('Full Pipeline Integration', () => {
  describe('ConnectionBridge → EnvelopeProtocol → RPC', () => {
    it('should route signed RPC through LAN gateway', async () => {
      const httpAdapter = createHttpAdapter({
        '/api/chat/messages': [
          { id: 'msg-1', text: 'Hello from LAN', sender: 'Alice' },
          { id: 'msg-2', text: 'Hi there!', sender: 'Bob' },
        ],
      });

      const bridge = new ConnectionBridge(createBridgeConfig(), {
        probeAdapter: createLanProbe(true),
        httpAdapter,
      });

      await bridge.initialize();
      expect(bridge.getRoute()).toBe('lan');

      const response = await bridge.rpc({
        method: '/api/chat/messages',
        params: { roomId: 'room-1' },
        signType: 'HMAC',
      });

      expect(response.route).toBe('lan');
      expect(response.data).toHaveLength(2);

      // Verify envelope headers were sent
      expect(httpAdapter.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('192.168.1.200:8443/api/chat/messages'),
          headers: expect.objectContaining({
            'X-Sign-Type': 'HMAC',
            'X-Sign': expect.any(String),
            'X-Msg-Id': expect.any(String),
            'X-Timestamp': expect.any(String),
          }),
        })
      );
    });

    it('should enforce privacy: block data to cloud when syncToCloud=false', async () => {
      const bridge = new ConnectionBridge(
        createBridgeConfig({ syncToCloud: false }),
        {
          probeAdapter: createLanProbe(false),
          httpAdapter: createHttpAdapter({}),
        }
      );

      await bridge.initialize();
      expect(bridge.getRoute()).toBe('cloud');

      // Non-data request should work
      const schemaResp = await bridge.rpc({
        method: '/api/schema/home',
        isDataRequest: false,
      });
      expect(schemaResp.route).toBe('cloud');

      // Data request should be blocked
      await expect(
        bridge.rpc({
          method: '/api/user/save',
          params: { name: 'Secret' },
          isDataRequest: true,
        })
      ).rejects.toThrow('syncToCloud is disabled');
    });

    it('should failover from LAN to cloud and sign correctly', async () => {
      let callCount = 0;
      const failoverHttp: DataHttpAdapter = {
        request: vi.fn().mockImplementation(async (req) => {
          callCount++;
          if (req.url.includes('192.168.1.200')) {
            throw new Error('LAN connection reset');
          }
          return { code: 0, message: 'ok', data: { via: 'cloud' } } as ApiResponse;
        }),
      };

      const bridge = new ConnectionBridge(
        createBridgeConfig({ syncToCloud: true }),
        {
          probeAdapter: createLanProbe(true),
          httpAdapter: failoverHttp,
        }
      );

      await bridge.initialize();
      expect(bridge.getRoute()).toBe('lan');

      const response = await bridge.rpc({
        method: '/api/getData',
        isDataRequest: true,
      });

      expect(response.route).toBe('cloud');
      expect(response.data).toEqual({ via: 'cloud' });
      expect(bridge.getRoute()).toBe('cloud'); // Route switched
    });
  });

  describe('EnvelopeProtocol seal + verify round-trip', () => {
    it('should seal and verify with all three sign types', () => {
      const protocol = new EnvelopeProtocol({
        sessionToken: 'my-session',
        hmacSecret: 'my-secret',
      });

      const payload = {
        method: '/api/order/create',
        params: { productId: 42, quantity: 2 },
      };

      for (const signType of ['SESSION', 'HMAC', 'MD5'] as const) {
        const envelope = protocol.seal(payload, signType);

        expect(envelope.msgId).toBeTruthy();
        expect(envelope.timestamp).toBeGreaterThan(0);
        expect(envelope.signType).toBe(signType);
        expect(envelope.sign).toBeTruthy();
        expect(envelope.body).toEqual(payload);

        // Verify the signature
        expect(protocol.verify(envelope)).toBe(true);
      }
    });

    it('should detect tampered envelopes', () => {
      const protocol = new EnvelopeProtocol({
        sessionToken: 'token',
        hmacSecret: 'secret',
      });

      const envelope = protocol.seal({ data: 'original' }, 'HMAC');
      expect(protocol.verify(envelope)).toBe(true);

      // Tamper with the body
      const tampered = { ...envelope, body: { data: 'tampered' } };
      expect(protocol.verify(tampered)).toBe(false);
    });
  });

  describe('BuildParams → ActionEngine → ListContainer', () => {
    let actionEngine: ActionEngine;
    let navAdapter: NavigationAdapter;
    let rpcAdapter: ActionRpcAdapter;
    let dataStore: DataStoreAdapter & { store: Record<string, unknown> };
    let listContainer: ListContainer;

    beforeEach(() => {
      actionEngine = new ActionEngine(false);

      navAdapter = { navigateTo: vi.fn() };
      rpcAdapter = {
        call: vi.fn().mockResolvedValue({
          code: 0,
          message: 'ok',
          data: { confirmed: true, timestamp: Date.now() },
          route: 'lan' as const,
        } satisfies RpcResponse),
      };
      const store: Record<string, unknown> = {};
      dataStore = {
        store,
        getData: vi.fn().mockReturnValue(store),
        setData: vi.fn().mockImplementation((path: string, value: unknown) => {
          store[path] = value;
        }),
        notifyChange: vi.fn(),
      };

      actionEngine.setNavigationAdapter(navAdapter);
      actionEngine.setRpcAdapter(rpcAdapter);
      actionEngine.setDataStore(dataStore);

      listContainer = new ListContainer(false);
      listContainer.setActionEngine(actionEngine);
    });

    it('should render IM chat and dispatch card action with resolved params', async () => {
      // Simulate an IM chat: messages + an action card for order confirmation
      const chatMessages: MessageCard[] = [
        {
          id: 'msg-1',
          cardType: 'text',
          sender: { name: '客服小美', avatar: 'avatar1.png' },
          timestamp: 1713300000000,
          content: { text: '您好！您的订单 ORD-2024-0001 已确认。' },
        },
        {
          id: 'msg-2',
          cardType: 'image',
          sender: { name: '客服小美' },
          timestamp: 1713300010000,
          content: { src: 'https://cdn.example.com/product.jpg', alt: '商品图片' },
        },
        {
          id: 'msg-3',
          cardType: 'action',
          sender: { name: '系统' },
          timestamp: 1713300020000,
          content: { text: '请确认收货', orderId: 'ORD-2024-0001', amount: 199 },
          actions: [
            {
              label: '确认收货',
              action: {
                type: 'rpcCall',
                method: '/api/order/confirmReceipt',
                body: {
                  orderId: '${context.row.orderId}',
                  amount: '${context.row.amount}',
                },
                onSuccess: {
                  type: 'updateData',
                  target: 'order.status',
                  value: 'completed',
                },
              },
            },
            {
              label: '查看详情',
              action: {
                type: 'Maps',
                url: '/pages/order/detail?id=${context.row.orderId}',
              },
            },
          ],
        },
        {
          id: 'msg-4',
          cardType: 'system',
          timestamp: 1713300030000,
          content: { message: '对话已结束' },
        },
      ];

      // Step 1: Render the chat list
      const output = listContainer.render('chat-container', { items: chatMessages });

      expect(output.id).toBe('chat-container');
      expect(output.cards).toHaveLength(4);
      expect(output.cards[0].cardType).toBe('text');
      expect(output.cards[1].cardType).toBe('image');
      expect(output.cards[2].cardType).toBe('action');
      expect(output.cards[3].cardType).toBe('system');

      // Step 2: Verify action card has buttons
      const actionCard = output.cards[2];
      expect(actionCard.actions).toHaveLength(2);
      expect(actionCard.actions![0].label).toBe('确认收货');
      expect(actionCard.actions![1].label).toBe('查看详情');

      // Step 3: Click "确认收货" → triggers rpcCall with resolved params
      actionCard.actions![0].handler();
      await new Promise((r) => setTimeout(r, 20));

      expect(rpcAdapter.call).toHaveBeenCalledWith(
        '/api/order/confirmReceipt',
        { orderId: 'ORD-2024-0001', amount: 199 }
      );

      // Step 4: onSuccess should have updated the data store
      expect(dataStore.setData).toHaveBeenCalledWith('order.status', 'completed');
      expect(dataStore.notifyChange).toHaveBeenCalledWith('order.status');

      // Step 5: Click "查看详情" → triggers navigation with resolved URL
      actionCard.actions![1].handler();
      await new Promise((r) => setTimeout(r, 20));

      expect(navAdapter.navigateTo).toHaveBeenCalledWith(
        '/pages/order/detail?id=ORD-2024-0001'
      );
    });

    it('should handle incremental chat: append + remove cards', () => {
      const initial: ListDataSource = {
        items: [
          {
            id: 'msg-1',
            cardType: 'text',
            sender: { name: 'Alice' },
            timestamp: Date.now(),
            content: { text: '你好！' },
          },
        ],
      };

      let output = listContainer.render('chat', initial);
      expect(output.cards).toHaveLength(1);

      // Append a new message
      output = listContainer.appendCard(output, {
        id: 'msg-2',
        cardType: 'text',
        sender: { name: 'Bob' },
        timestamp: Date.now(),
        content: { text: '你好，有什么需要帮助的吗？' },
      });
      expect(output.cards).toHaveLength(2);

      // Append a system message
      output = listContainer.appendCard(output, {
        id: 'sys-1',
        cardType: 'system',
        timestamp: Date.now(),
        content: { message: 'Bob 加入了对话' },
      });
      expect(output.cards).toHaveLength(3);

      // Remove the system message
      output = listContainer.removeCard(output, 'sys-1');
      expect(output.cards).toHaveLength(2);
      expect(output.cards.map((c) => c.id)).toEqual(['msg-1', 'msg-2']);
    });

    it('should resolve complex nested BuildParams in action bodies', async () => {
      const context: BuildParamsContext = {
        formData: {
          address: '杭州市西湖区',
          phone: '13800138000',
          remark: '请尽快发货',
        },
        context: {
          row: {
            orderId: 'ORD-999',
            items: [
              { sku: 'SKU-A', qty: 2 },
              { sku: 'SKU-B', qty: 1 },
            ],
          },
        },
        userId: 12345,
      };

      const actionBody = {
        order: '${context.row.orderId}',
        shipping: {
          address: '${formData.address}',
          phone: '${formData.phone}',
        },
        remark: '${formData.remark}',
        operator: '${userId}',
      };

      const resolved = BuildParams.resolve(actionBody, context);

      expect(resolved).toEqual({
        order: 'ORD-999',
        shipping: {
          address: '杭州市西湖区',
          phone: '13800138000',
        },
        remark: '请尽快发货',
        operator: 12345,
      });

      // Dispatch this as an rpcCall action
      const action: ActionDescriptor = {
        type: 'rpcCall',
        method: '/api/order/ship',
        body: actionBody,
      };

      const result = await actionEngine.dispatch(action, context);
      expect(result.success).toBe(true);

      expect(rpcAdapter.call).toHaveBeenCalledWith('/api/order/ship', {
        order: 'ORD-999',
        shipping: {
          address: '杭州市西湖区',
          phone: '13800138000',
        },
        remark: '请尽快发货',
        operator: 12345,
      });
    });
  });

  describe('Full E2E: Bridge → ActionEngine → ListContainer → DataStore', () => {
    it('should simulate a complete IM agent interaction flow', async () => {
      // 1. Setup ConnectionBridge on LAN
      const httpResponses: Record<string, unknown> = {
        '/api/chat/messages': [
          { id: 'm1', text: '你好', sender: 'user' },
          { id: 'm2', text: '你好！有什么可以帮您？', sender: 'agent' },
        ],
        '/api/order/confirmReceipt': { success: true, newStatus: 'completed' },
      };

      const httpAdapter = createHttpAdapter(httpResponses);
      const bridge = new ConnectionBridge(
        createBridgeConfig({ syncToCloud: false }),
        { probeAdapter: createLanProbe(true), httpAdapter }
      );

      await bridge.initialize();
      expect(bridge.getRoute()).toBe('lan');

      // 2. Fetch chat messages via bridge
      const messagesResp = await bridge.rpc<Array<{ id: string; text: string; sender: string }>>({
        method: '/api/chat/messages',
        params: { roomId: 'support-1' },
        isDataRequest: true, // Allowed because we're on LAN
      });
      expect(messagesResp.route).toBe('lan');
      expect(messagesResp.data).toHaveLength(2);

      // 3. Create ActionEngine backed by bridge
      const actionEngine = new ActionEngine(false);
      const bridgeRpcAdapter: ActionRpcAdapter = {
        call: async (method, params) => {
          return bridge.rpc({ method, params, isDataRequest: true });
        },
      };
      actionEngine.setRpcAdapter(bridgeRpcAdapter);

      const store: Record<string, unknown> = {};
      actionEngine.setDataStore({
        getData: () => store,
        setData: (path, value) => { store[path] = value; },
        notifyChange: vi.fn(),
      });

      // 4. Build IM cards from fetched data
      const listContainer = new ListContainer(false);
      listContainer.setActionEngine(actionEngine);

      const cards: MessageCard[] = (messagesResp.data as Array<{ id: string; text: string; sender: string }>).map((m) => ({
        id: m.id,
        cardType: 'text' as const,
        sender: { name: m.sender },
        timestamp: Date.now(),
        content: { text: m.text },
      }));

      // Add an action card
      cards.push({
        id: 'action-confirm',
        cardType: 'action',
        sender: { name: 'system' },
        timestamp: Date.now(),
        content: { text: '确认订单？', orderId: 'ORD-100' },
        actions: [
          {
            label: '确认',
            action: {
              type: 'rpcCall',
              method: '/api/order/confirmReceipt',
              body: { orderId: '${context.row.orderId}' },
              onSuccess: {
                type: 'updateData',
                target: 'order.status',
                value: '${response.newStatus}',
              },
            },
          },
        ],
      });

      const chatOutput = listContainer.render('support-chat', { items: cards });
      expect(chatOutput.cards).toHaveLength(3);

      // 5. Trigger action: confirm order
      chatOutput.cards[2].actions![0].handler();
      await new Promise((r) => setTimeout(r, 50));

      // Verify: RPC was called through bridge (LAN)
      expect(httpAdapter.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('192.168.1.200:8443/api/order/confirmReceipt'),
        })
      );

      // Verify: DataStore was updated via onSuccess
      expect(store['order.status']).toBe('completed');
    });
  });
});
