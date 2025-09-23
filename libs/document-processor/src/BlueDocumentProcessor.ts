import { Blue } from '@blue-labs/language';
import {
  DocumentNode,
  EventNodePayload,
  ProcessingOptions,
  ProcessingResult,
} from './types';
import { QuickJsBlueDocumentProcessor } from './quickjs/QuickJsBlueDocumentProcessor';
import { QuickJsHostBridge } from './quickjs/QuickJsHostBridge';
import { createQuickJsBlueDocumentProcessorWithDefaults } from './quickjs/createQuickJsBlueDocumentProcessorWithDefaults';
import { getQuickJsEntrySource } from './quickjs/runtime/getQuickJsEntrySource';

/**
 * Host-facing wrapper that delegates document processing to the QuickJS runtime.
 *
 * Tests and consumers can continue to instantiate this class; under the hood it
 * builds (or loads) the QuickJS bundle and forwards calls to the sandboxed
 * processor. The original synchronous implementation lives in
 * `NativeBlueDocumentProcessor` and is consumed by the QuickJS bundle itself.
 */
export class BlueDocumentProcessor {
  private quickProcessor?: QuickJsBlueDocumentProcessor;
  private bridge?: QuickJsHostBridge;
  private ready: Promise<void> | null = null;

  constructor(private readonly blue: Blue) {}

  private async ensureReady(): Promise<void> {
    if (this.quickProcessor) return;
    if (!this.ready) {
      this.ready = (async () => {
        const entrySource = await getQuickJsEntrySource();
        const { processor, bridge } =
          createQuickJsBlueDocumentProcessorWithDefaults({
            entrySource,
            blue: this.blue,
          });
        this.quickProcessor = processor;
        this.bridge = bridge;
      })();
    }
    await this.ready;
  }

  async initialize(
    document: DocumentNode,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    await this.ensureReady();
    const processor = this.quickProcessor;
    if (!processor) {
      throw new Error('QuickJS document processor failed to initialise');
    }
    return processor.initialize(document, options);
  }

  async processEvents(
    document: DocumentNode,
    events: EventNodePayload[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    await this.ensureReady();
    const processor = this.quickProcessor;
    if (!processor) {
      throw new Error('QuickJS document processor failed to process events');
    }
    return processor.processEvents(document, events, options);
  }

  async dispose(): Promise<void> {
    await this.bridge?.dispose();
    this.bridge = undefined;
    this.quickProcessor = undefined;
    this.ready = null;
  }
}
