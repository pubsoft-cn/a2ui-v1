/**
 * Renderer - Dynamic Component Tree Renderer
 *
 * Takes a RenderNode tree (output from BindingEngine) and produces
 * a platform-neutral representation that can be consumed by the
 * view layer (Vue component, React component, or native mini-program template).
 *
 * This module also provides the component registry for mapping
 * component types to their renderers.
 */

import type {
  RenderNode,
  ComponentType,
  EventBinding,
  ActionDefinition,
} from '../types';

/** Component render output - platform-neutral descriptor */
export interface ComponentRenderOutput {
  /** The component type identifier */
  type: ComponentType;
  /** Resolved props */
  props: Record<string, unknown>;
  /** Inline styles */
  style?: Record<string, string | number | undefined>;
  /** CSS class */
  className?: string;
  /** Rendered children */
  children?: ComponentRenderOutput[];
  /** Event handlers */
  eventHandlers?: Record<string, () => void>;
}

/** Component definition in the registry */
export interface ComponentDefinition {
  /** Component type */
  type: ComponentType;
  /** Default props */
  defaultProps?: Record<string, unknown>;
  /** Validate props before rendering */
  validate?: (props: Record<string, unknown>) => boolean;
  /** Transform props for platform-specific rendering */
  transformProps?: (props: Record<string, unknown>) => Record<string, unknown>;
}

/** Event handler callback */
export type EventHandler = (action: ActionDefinition, event?: unknown) => void;

export class Renderer {
  private registry: Map<ComponentType, ComponentDefinition> = new Map();
  private eventHandler: EventHandler | null = null;
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
    this.registerBuiltinComponents();
  }

  /**
   * Register the built-in component types.
   */
  private registerBuiltinComponents(): void {
    const builtins: ComponentDefinition[] = [
      { type: 'view', defaultProps: {} },
      { type: 'text', defaultProps: { content: '' } },
      {
        type: 'image',
        defaultProps: { src: '', mode: 'aspectFit' },
        validate: (props) => typeof props['src'] === 'string' && props['src'] !== '',
      },
      { type: 'button', defaultProps: { text: '', disabled: false } },
      { type: 'input', defaultProps: { placeholder: '', value: '' } },
      { type: 'list', defaultProps: {} },
      { type: 'scroll-view', defaultProps: { scrollY: true } },
      { type: 'swiper', defaultProps: { autoplay: false, interval: 3000 } },
      { type: 'form', defaultProps: {} },
      { type: 'custom', defaultProps: {} },
    ];

    for (const component of builtins) {
      this.registry.set(component.type, component);
    }
  }

  /**
   * Register a custom component type.
   */
  registerComponent(definition: ComponentDefinition): void {
    this.registry.set(definition.type, definition);
    this.log(`Component registered: ${definition.type}`);
  }

  /**
   * Set the global event handler for action dispatching.
   */
  setEventHandler(handler: EventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Render a RenderNode tree into ComponentRenderOutput tree.
   */
  render(node: RenderNode): ComponentRenderOutput | null {
    const definition = this.registry.get(node.type);

    if (!definition) {
      this.log(`Unknown component type: ${node.type}, rendering as view`);
      // Fallback to view
    }

    // Merge default props with resolved props
    const mergedProps = {
      ...(definition?.defaultProps ?? {}),
      ...node.props,
    };

    // Validate if validator exists
    if (definition?.validate && !definition.validate(mergedProps)) {
      this.log(`Validation failed for ${node.type} (${node.id}), skipping`);
      return null;
    }

    // Transform props if transformer exists
    const finalProps = definition?.transformProps
      ? definition.transformProps(mergedProps)
      : mergedProps;

    // Build event handlers
    const eventHandlers = this.buildEventHandlers(node.events);

    // Render children recursively
    const children = node.children
      ? node.children
          .map((child) => this.render(child))
          .filter((c): c is ComponentRenderOutput => c !== null)
      : undefined;

    return {
      type: node.type,
      props: finalProps,
      style: node.style,
      className: node.className,
      children: children && children.length > 0 ? children : undefined,
      eventHandlers:
        eventHandlers && Object.keys(eventHandlers).length > 0
          ? eventHandlers
          : undefined,
    };
  }

  /**
   * Flatten the render tree for measuring performance.
   */
  countNodes(output: ComponentRenderOutput): number {
    let count = 1;
    if (output.children) {
      for (const child of output.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  /**
   * Get all registered component types.
   */
  getRegisteredTypes(): ComponentType[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Build event handler functions from event bindings.
   */
  private buildEventHandlers(
    events?: EventBinding[]
  ): Record<string, () => void> | undefined {
    if (!events || events.length === 0) return undefined;

    const handlers: Record<string, () => void> = {};

    for (const event of events) {
      handlers[event.type] = () => {
        if (this.eventHandler) {
          this.eventHandler(event.action);
        } else {
          this.log(`No event handler set, ignoring event: ${event.type}`);
        }
      };
    }

    return handlers;
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[A2UI Renderer] ${message}`);
    }
  }
}
