import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Renderer, type EventHandler } from '../../src/core/Renderer';
import type { RenderNode } from '../../src/types';

describe('Renderer', () => {
  let renderer: Renderer;

  beforeEach(() => {
    renderer = new Renderer(false);
  });

  describe('built-in components', () => {
    it('should have all built-in component types registered', () => {
      const types = renderer.getRegisteredTypes();
      expect(types).toContain('view');
      expect(types).toContain('text');
      expect(types).toContain('image');
      expect(types).toContain('button');
      expect(types).toContain('input');
      expect(types).toContain('list');
      expect(types).toContain('scroll-view');
      expect(types).toContain('swiper');
      expect(types).toContain('form');
      expect(types).toContain('custom');
    });
  });

  describe('render', () => {
    it('should render a simple node', () => {
      const node: RenderNode = {
        id: 'root',
        type: 'view',
        props: { class: 'container' },
      };

      const output = renderer.render(node);
      expect(output).not.toBeNull();
      expect(output!.type).toBe('view');
      expect(output!.props['class']).toBe('container');
    });

    it('should merge default props', () => {
      const node: RenderNode = {
        id: 'btn',
        type: 'button',
        props: { text: 'Submit' },
      };

      const output = renderer.render(node);
      expect(output!.props['text']).toBe('Submit');
      expect(output!.props['disabled']).toBe(false);
    });

    it('should render nested children', () => {
      const node: RenderNode = {
        id: 'root',
        type: 'view',
        props: {},
        children: [
          { id: 'child1', type: 'text', props: { content: 'Hello' } },
          { id: 'child2', type: 'text', props: { content: 'World' } },
        ],
      };

      const output = renderer.render(node);
      expect(output!.children).toHaveLength(2);
      expect(output!.children![0].props['content']).toBe('Hello');
      expect(output!.children![1].props['content']).toBe('World');
    });

    it('should render with style and className', () => {
      const node: RenderNode = {
        id: 'styled',
        type: 'view',
        props: {},
        style: { color: 'red', fontSize: 14 },
        className: 'my-class',
      };

      const output = renderer.render(node);
      expect(output!.style).toEqual({ color: 'red', fontSize: 14 });
      expect(output!.className).toBe('my-class');
    });

    it('should validate image component (skip invalid)', () => {
      const node: RenderNode = {
        id: 'img',
        type: 'image',
        props: { src: '' }, // Invalid: empty src
      };

      const output = renderer.render(node);
      expect(output).toBeNull();
    });

    it('should render valid image component', () => {
      const node: RenderNode = {
        id: 'img',
        type: 'image',
        props: { src: 'https://example.com/img.png' },
      };

      const output = renderer.render(node);
      expect(output).not.toBeNull();
      expect(output!.props['src']).toBe('https://example.com/img.png');
    });

    it('should handle unknown component types as view fallback', () => {
      const node: RenderNode = {
        id: 'unknown',
        type: 'custom' as any,
        props: { data: 'value' },
      };

      const output = renderer.render(node);
      expect(output).not.toBeNull();
    });
  });

  describe('event handling', () => {
    it('should build event handlers from bindings', () => {
      const handler = vi.fn();
      renderer.setEventHandler(handler);

      const node: RenderNode = {
        id: 'btn',
        type: 'button',
        props: { text: 'Click' },
        events: [
          {
            type: 'tap',
            action: {
              type: 'navigate',
              payload: { url: '/detail' },
            },
          },
        ],
      };

      const output = renderer.render(node);
      expect(output!.eventHandlers).toBeDefined();
      expect(output!.eventHandlers!['tap']).toBeDefined();

      // Trigger the event
      output!.eventHandlers!['tap']();
      expect(handler).toHaveBeenCalledWith({
        type: 'navigate',
        payload: { url: '/detail' },
      });
    });

    it('should handle missing event handler gracefully', () => {
      const node: RenderNode = {
        id: 'btn',
        type: 'button',
        props: {},
        events: [
          {
            type: 'tap',
            action: { type: 'api', payload: {} },
          },
        ],
      };

      const output = renderer.render(node);
      // Should not throw when no handler is set
      expect(() => output!.eventHandlers!['tap']()).not.toThrow();
    });
  });

  describe('registerComponent', () => {
    it('should register and use custom components', () => {
      renderer.registerComponent({
        type: 'custom' as any,
        defaultProps: { variant: 'default' },
        transformProps: (props) => ({
          ...props,
          transformed: true,
        }),
      });

      const node: RenderNode = {
        id: 'custom1',
        type: 'custom',
        props: { data: 'test' },
      };

      const output = renderer.render(node);
      expect(output!.props['variant']).toBe('default');
      expect(output!.props['data']).toBe('test');
      expect(output!.props['transformed']).toBe(true);
    });
  });

  describe('countNodes', () => {
    it('should count all nodes in a tree', () => {
      const output = renderer.render({
        id: 'root',
        type: 'view',
        props: {},
        children: [
          { id: 'a', type: 'text', props: {} },
          {
            id: 'b',
            type: 'view',
            props: {},
            children: [
              { id: 'c', type: 'text', props: {} },
              { id: 'd', type: 'text', props: {} },
            ],
          },
        ],
      })!;

      expect(renderer.countNodes(output)).toBe(5);
    });
  });
});
