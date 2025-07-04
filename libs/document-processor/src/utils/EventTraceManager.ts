import { EventNode } from '../types';

/**
 * Manages event tracing functionality for the Blue Document Processor
 */
export class EventTraceManager {
  private readonly isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.TRACE_BLUE_ENABLED === 'true';
  }

  /**
   * Creates a hop entry for the trace
   * @param nodePath - The path to the node
   * @param contractName - The name of the contract
   * @returns A formatted hop string
   */
  private makeHop(nodePath: string, contractName: string): string {
    return `${nodePath}#${contractName}`;
  }

  /**
   * Checks if tracing is enabled
   * @returns Whether tracing is enabled
   */
  private shouldTrace(): boolean {
    return this.isEnabled;
  }

  /**
   * Adds a hop to the event's trace if tracing is enabled
   * @param event - The event to add the trace to
   * @param nodePath - The path to the node
   * @param contractName - The name of the contract
   * @returns A new event with the updated trace
   */
  addHop(event: EventNode, nodePath: string, contractName: string): EventNode {
    if (!this.shouldTrace()) {
      return { ...event };
    }

    const newTrace = [
      ...(event.trace ?? []),
      this.makeHop(nodePath, contractName),
    ];
    return {
      ...event,
      trace: newTrace,
    };
  }

  /**
   * Gets the current trace for an event
   * @param event - The event to get the trace for
   * @returns The current trace array or an empty array if none exists
   */
  getTrace(event: EventNode): string[] {
    return event.trace ?? [];
  }

  /**
   * Clears the trace for an event
   * @param event - The event to clear the trace for
   * @returns A new event with an empty trace
   */
  clearTrace(event: EventNode): EventNode {
    return {
      ...event,
      trace: [],
    };
  }

  /**
   * Checks if tracing is enabled globally
   * @returns Whether tracing is enabled
   */
  isTracingEnabled(): boolean {
    return this.isEnabled;
  }
}
