import { Blue } from '@blue-labs/language';
import {
  DocumentNode,
  EventNodePayload,
  ProcessingOptions,
  ProcessingResult,
} from '../types';
import { QuickJsHostBridge, ProcessorResponse } from './QuickJsHostBridge';

interface QuickJsProcessingResult {
  state: unknown;
  emitted?: unknown[];
  gasUsed?: number;
  gasRemaining?: number;
}

export class QuickJsBlueDocumentProcessor {
  constructor(
    private readonly blue: Blue,
    private readonly bridge: QuickJsHostBridge
  ) {}

  async initialize(
    document: DocumentNode,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const payload = this.blue.nodeToJson(document, 'original');
    const response = await this.bridge.call({
      method: 'initialize',
      document: payload,
      options,
    });

    const result = this.unwrapResponse(response);
    return this.toProcessingResult(result);
  }

  async processEvents(
    document: DocumentNode,
    events: EventNodePayload[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const payload = this.blue.nodeToJson(document, 'original');
    const eventsPayload = events.map((event) =>
      this.blue.nodeToJson(event as DocumentNode, 'original')
    );

    const response = await this.bridge.call({
      method: 'processEvents',
      document: payload,
      events: eventsPayload,
      options,
    });

    const result = this.unwrapResponse(response);
    return this.toProcessingResult(result);
  }

  private unwrapResponse(response: ProcessorResponse): QuickJsProcessingResult {
    if (!response.ok) {
      const message = response.error?.message ?? 'QuickJS processing failed';
      const error = new Error(message);
      if (response.error?.name) {
        error.name = response.error.name;
      }
      throw error;
    }

    if (!response.result || typeof response.result !== 'object') {
      throw new Error('QuickJS returned an invalid result payload');
    }

    return response.result as QuickJsProcessingResult;
  }

  private toProcessingResult(result: QuickJsProcessingResult): ProcessingResult {
    if (!result.state) {
      throw new Error('QuickJS result missing state');
    }

    const stateNode = this.blue.jsonValueToNode(result.state);
    const emitted = (result.emitted ?? []).map((value) =>
      this.blue.jsonValueToNode(value)
    );

    return {
      state: stateNode,
      emitted,
      gasUsed: result.gasUsed,
      gasRemaining: result.gasRemaining,
    };
  }
}
