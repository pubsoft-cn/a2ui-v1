/**
 * ListContainer - IM-Style Message Card Renderer
 *
 * Renders a list of IM-style message cards based on Schema definitions.
 * Supports:
 * - Basic list rendering (text, image, system messages)
 * - Action cards (with interactive buttons defined by Schema)
 *
 * Each card has: sender info, timestamp, content body, and optional actions.
 */

import type {
  MessageCard,
  MessageCardType,
  MessageCardAction,
  ListContainerOutput,
  RenderedCard,
  ActionDescriptor,
} from '../types';
import { BuildParams, type BuildParamsContext } from './BuildParams';
import type { ActionEngine } from './ActionEngine';

/** Data source for the list container */
export interface ListDataSource {
  /** Array of message card data items */
  items: MessageCard[];
}

export class ListContainer {
  private actionEngine: ActionEngine | null = null;
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  /**
   * Set the action engine for handling card actions.
   */
  setActionEngine(engine: ActionEngine): void {
    this.actionEngine = engine;
  }

  /**
   * Render a list of message cards into a ListContainerOutput.
   */
  render(
    containerId: string,
    dataSource: ListDataSource,
    context?: BuildParamsContext
  ): ListContainerOutput {
    const ctx = context ?? {};

    const cards: RenderedCard[] = dataSource.items
      .map((item) => this.renderCard(item, ctx))
      .filter((card): card is RenderedCard => card !== null);

    this.log(`Rendered ${cards.length} cards in container "${containerId}"`);

    return { id: containerId, cards };
  }

  /**
   * Render a single message card.
   */
  renderCard(
    card: MessageCard,
    context: BuildParamsContext
  ): RenderedCard | null {
    const props = this.buildCardProps(card, context);

    const actions = card.actions
      ? this.buildCardActions(card.actions, card, context)
      : undefined;

    return {
      id: card.id,
      cardType: card.cardType,
      props,
      actions,
    };
  }

  /**
   * Append a new card to an existing output (for streaming/incremental updates).
   */
  appendCard(
    output: ListContainerOutput,
    card: MessageCard,
    context?: BuildParamsContext
  ): ListContainerOutput {
    const rendered = this.renderCard(card, context ?? {});
    if (rendered) {
      return {
        ...output,
        cards: [...output.cards, rendered],
      };
    }
    return output;
  }

  /**
   * Remove a card from the output by ID.
   */
  removeCard(output: ListContainerOutput, cardId: string): ListContainerOutput {
    return {
      ...output,
      cards: output.cards.filter((c) => c.id !== cardId),
    };
  }

  /**
   * Get supported card types.
   */
  getSupportedCardTypes(): MessageCardType[] {
    return ['text', 'image', 'action', 'system', 'custom'];
  }

  // ── Private Methods ──────────────────────────────────────────

  /**
   * Build resolved props for a card based on its type.
   */
  private buildCardProps(
    card: MessageCard,
    context: BuildParamsContext
  ): Record<string, unknown> {
    // Create a card-scoped context
    const cardContext: BuildParamsContext = {
      ...context,
      card: card.content,
      sender: card.sender as Record<string, unknown> | undefined,
    };

    const baseProps: Record<string, unknown> = {
      cardType: card.cardType,
      timestamp: card.timestamp,
      sender: card.sender,
    };

    // Resolve content values that may contain templates
    const resolvedContent: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(card.content)) {
      resolvedContent[key] = BuildParams.resolveValue(value, cardContext);
    }

    return { ...baseProps, content: resolvedContent };
  }

  /**
   * Build action handlers for card action buttons.
   */
  private buildCardActions(
    actions: MessageCardAction[],
    card: MessageCard,
    context: BuildParamsContext
  ): Array<{ label: string; handler: () => void }> {
    return actions.map((action) => {
      const actionContext: BuildParamsContext = {
        ...context,
        context: {
          ...(typeof context.context === 'object' && context.context !== null
            ? (context.context as Record<string, unknown>)
            : {}),
          row: card.content,
        },
        card: card.content,
      };

      return {
        label: action.label,
        handler: () => {
          this.dispatchAction(action.action, actionContext);
        },
      };
    });
  }

  /**
   * Dispatch an action through the ActionEngine.
   */
  private dispatchAction(action: ActionDescriptor, context: BuildParamsContext): void {
    if (!this.actionEngine) {
      this.log('No ActionEngine configured, ignoring action');
      return;
    }

    void this.actionEngine.dispatch(action, context);
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[A2UI ListContainer] ${message}`);
    }
  }
}
