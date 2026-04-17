import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListContainer, type ListDataSource } from '../../src/core/ListContainer';
import { ActionEngine, type ActionRpcAdapter } from '../../src/core/ActionEngine';
import type { MessageCard, RpcResponse } from '../../src/types';

function createTextCard(id: string, text: string): MessageCard {
  return {
    id,
    cardType: 'text',
    sender: { name: 'Alice', avatar: 'https://example.com/alice.png' },
    timestamp: Date.now(),
    content: { text },
  };
}

function createImageCard(id: string, src: string): MessageCard {
  return {
    id,
    cardType: 'image',
    sender: { name: 'Bob' },
    timestamp: Date.now(),
    content: { src, alt: 'An image' },
  };
}

function createActionCard(id: string, text: string): MessageCard {
  return {
    id,
    cardType: 'action',
    sender: { name: 'System' },
    timestamp: Date.now(),
    content: { text },
    actions: [
      {
        label: 'Confirm',
        action: {
          type: 'rpcCall',
          method: '/api/confirm',
          body: { cardId: '${context.row.id}' },
        },
      },
      {
        label: 'Cancel',
        action: {
          type: 'updateData',
          target: 'selectedCard',
          value: null,
        },
      },
    ],
  };
}

function createSystemCard(id: string, message: string): MessageCard {
  return {
    id,
    cardType: 'system',
    timestamp: Date.now(),
    content: { message },
  };
}

describe('ListContainer', () => {
  let container: ListContainer;

  beforeEach(() => {
    container = new ListContainer(false);
  });

  describe('render', () => {
    it('should render a list of text cards', () => {
      const dataSource: ListDataSource = {
        items: [
          createTextCard('msg-1', 'Hello!'),
          createTextCard('msg-2', 'How are you?'),
          createTextCard('msg-3', 'Fine, thanks!'),
        ],
      };

      const output = container.render('chat-list', dataSource);

      expect(output.id).toBe('chat-list');
      expect(output.cards).toHaveLength(3);
      expect(output.cards[0].id).toBe('msg-1');
      expect(output.cards[0].cardType).toBe('text');
      expect(output.cards[0].props.content).toEqual({ text: 'Hello!' });
    });

    it('should render mixed card types', () => {
      const dataSource: ListDataSource = {
        items: [
          createTextCard('msg-1', 'Check this out:'),
          createImageCard('msg-2', 'https://example.com/photo.jpg'),
          createSystemCard('msg-3', 'Alice joined the chat'),
        ],
      };

      const output = container.render('mixed-list', dataSource);

      expect(output.cards).toHaveLength(3);
      expect(output.cards[0].cardType).toBe('text');
      expect(output.cards[1].cardType).toBe('image');
      expect(output.cards[2].cardType).toBe('system');
    });

    it('should include sender info in props', () => {
      const dataSource: ListDataSource = {
        items: [createTextCard('msg-1', 'Hello')],
      };

      const output = container.render('list', dataSource);
      expect(output.cards[0].props.sender).toEqual({
        name: 'Alice',
        avatar: 'https://example.com/alice.png',
      });
    });

    it('should include timestamp in props', () => {
      const card = createTextCard('msg-1', 'Hello');
      const dataSource: ListDataSource = { items: [card] };

      const output = container.render('list', dataSource);
      expect(output.cards[0].props.timestamp).toBe(card.timestamp);
    });

    it('should handle empty list', () => {
      const output = container.render('empty-list', { items: [] });
      expect(output.cards).toHaveLength(0);
    });
  });

  describe('action cards', () => {
    it('should render action buttons on action cards', () => {
      const dataSource: ListDataSource = {
        items: [createActionCard('action-1', 'Confirm order?')],
      };

      const output = container.render('action-list', dataSource);

      expect(output.cards[0].actions).toHaveLength(2);
      expect(output.cards[0].actions![0].label).toBe('Confirm');
      expect(output.cards[0].actions![1].label).toBe('Cancel');
    });

    it('should create callable action handlers', () => {
      const dataSource: ListDataSource = {
        items: [createActionCard('action-1', 'Test')],
      };

      const output = container.render('action-list', dataSource);

      // Handlers should be functions
      expect(typeof output.cards[0].actions![0].handler).toBe('function');
      expect(typeof output.cards[0].actions![1].handler).toBe('function');
    });

    it('should dispatch actions through ActionEngine', async () => {
      const mockRpc: ActionRpcAdapter = {
        call: vi.fn().mockResolvedValue({
          code: 0,
          message: 'ok',
          data: { confirmed: true },
          route: 'lan',
        } as RpcResponse),
      };

      const actionEngine = new ActionEngine(false);
      actionEngine.setRpcAdapter(mockRpc);
      container.setActionEngine(actionEngine);

      // Create an action card with an id in content (context.row = card.content)
      const card: MessageCard = {
        id: 'action-1',
        cardType: 'action',
        sender: { name: 'System' },
        timestamp: Date.now(),
        content: { text: 'Test', id: 'ORD-1' },
        actions: [
          {
            label: 'Confirm',
            action: {
              type: 'rpcCall',
              method: '/api/confirm',
              body: { cardId: '${context.row.id}' },
            },
          },
        ],
      };

      const dataSource: ListDataSource = { items: [card] };
      const output = container.render('action-list', dataSource);

      // Trigger the first action (rpcCall)
      output.cards[0].actions![0].handler();

      // Wait for async dispatch
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRpc.call).toHaveBeenCalledWith(
        '/api/confirm',
        { cardId: 'ORD-1' }
      );
    });
  });

  describe('appendCard', () => {
    it('should append a card to existing output', () => {
      const initial = container.render('list', {
        items: [createTextCard('msg-1', 'First')],
      });

      const updated = container.appendCard(
        initial,
        createTextCard('msg-2', 'Second')
      );

      expect(updated.cards).toHaveLength(2);
      expect(updated.cards[0].id).toBe('msg-1');
      expect(updated.cards[1].id).toBe('msg-2');
    });

    it('should not mutate the original output', () => {
      const initial = container.render('list', {
        items: [createTextCard('msg-1', 'First')],
      });

      container.appendCard(initial, createTextCard('msg-2', 'Second'));

      expect(initial.cards).toHaveLength(1);
    });
  });

  describe('removeCard', () => {
    it('should remove a card by ID', () => {
      const initial = container.render('list', {
        items: [
          createTextCard('msg-1', 'First'),
          createTextCard('msg-2', 'Second'),
          createTextCard('msg-3', 'Third'),
        ],
      });

      const updated = container.removeCard(initial, 'msg-2');

      expect(updated.cards).toHaveLength(2);
      expect(updated.cards[0].id).toBe('msg-1');
      expect(updated.cards[1].id).toBe('msg-3');
    });

    it('should handle removing non-existent card', () => {
      const initial = container.render('list', {
        items: [createTextCard('msg-1', 'First')],
      });

      const updated = container.removeCard(initial, 'non-existent');
      expect(updated.cards).toHaveLength(1);
    });
  });

  describe('getSupportedCardTypes', () => {
    it('should return all supported card types', () => {
      const types = container.getSupportedCardTypes();
      expect(types).toContain('text');
      expect(types).toContain('image');
      expect(types).toContain('action');
      expect(types).toContain('system');
      expect(types).toContain('custom');
    });
  });

  describe('template resolution in cards', () => {
    it('should resolve templates in card content', () => {
      const card: MessageCard = {
        id: 'tmpl-1',
        cardType: 'text',
        content: { text: '${formData.greeting}' },
      };

      const rendered = container.renderCard(card, {
        formData: { greeting: 'Hello World' },
      });

      expect(rendered).not.toBeNull();
      expect(rendered!.props.content).toEqual({ text: 'Hello World' });
    });
  });
});
