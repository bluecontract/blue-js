import {
  ContractProcessor,
  EventNode,
  DocumentNode,
  ProcessingContext,
  BlueId,
} from '../types';

export abstract class BaseChannelProcessor implements ContractProcessor {
  abstract readonly contractType: string;
  abstract readonly contractBlueId: BlueId;
  readonly role = 'adapter';

  /**
   * Base implementation of supports that checks if the event is not from a channel
   * Derived classes should call this method first in their supports implementation
   */
  protected baseSupports(event: EventNode): boolean {
    if (event.source === 'channel') return false;
    return true;
  }

  /**
   * Abstract method that derived classes must implement
   * Should contain specific logic for determining if the processor supports the event
   */
  abstract supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    contractName?: string
  ): boolean;

  /**
   * Abstract method that derived classes must implement
   * Should contain specific logic for handling the event
   */
  abstract handle(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    contractName?: string
  ): void | Promise<void>;

  /**
   * Base implementation that returns empty array
   * Can be overridden by derived classes if needed
   */
  init(): EventNode[] {
    return [];
  }
}
