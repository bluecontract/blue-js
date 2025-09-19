import {
  ContractProcessor,
  DocumentNode,
  EventNode,
  EventNodePayload,
  ProcessingResult,
} from './types';
import { InternalContext } from './context';
import {
  applyPatches,
  collectEmbeddedPathSpecs,
  isInside,
  freeze,
  mutable,
} from './utils/document';
import { EmbeddedDocumentModificationError } from './utils/exceptions';
import { isDocumentNode } from './utils/typeGuard';
import { TaskQueue } from './queue/TaskQueue';
import { ContractRegistry } from './registry/ContractRegistry';
import { EventRouter } from './routing/EventRouter';
import { logPatchError } from './utils/logPatchError';
import { ensureCheckpointContracts } from './utils/checkpoint';
import { ensureInitializedContract, isInitialized } from './utils/initialized';
import { ChannelEventCheckpointProcessor } from './processors/ChannelEventCheckpointProcessor';
import { CheckpointCache } from './utils/CheckpointCache';
import { Blue } from '@blue-labs/language';
import { defaultProcessors } from './config';
import { createDocumentProcessingInitiatedEvent } from './utils/eventFactories';

/**
 * BlueDocumentProcessor - Main orchestrator for document processing
 *
 * Orchestrates the document processing pipeline, managing state transitions
 * and event propagation through the registered contract processors.
 */
export class BlueDocumentProcessor {
  private taskCounter = 0;
  private eventCounter = 0;
  private readonly registry: ContractRegistry;
  private readonly queue: TaskQueue;
  private readonly router: EventRouter;
  private readonly checkpointCache = new CheckpointCache();

  /**
   * Creates a new document processor
   *
   * @param processors - Initial list of processors to register
   */
  constructor(
    private readonly blue: Blue,
    processors: ContractProcessor[] = defaultProcessors
  ) {
    this.registry = new ContractRegistry(processors);
    this.queue = new TaskQueue();
    this.router = new EventRouter(
      this.blue,
      this.registry,
      this.queue,
      () => ++this.taskCounter,
      () => ++this.eventCounter
    );

    this.register(
      new ChannelEventCheckpointProcessor(this.checkpointCache),
      9999
    );
  }

  /**
   * Registers a new contract processor
   *
   * @param cp - The processor to register
   * @param orderHint - Optional priority value for execution order
   */
  register(cp: ContractProcessor, orderHint?: number): void {
    this.registry.register(cp, orderHint);
  }

  /**
   * Initializes a document by emitting a Document Processing Initiated event
   *
   * @param document - The document to initialize
   * @returns Processing result with final state and emitted events
   */
  async initialize(document: DocumentNode): Promise<ProcessingResult> {
    let current = ensureCheckpointContracts(freeze(document), this.blue);

    // Emit the Document Processing Initiated event
    const initEvent: EventNode = {
      payload: createDocumentProcessingInitiatedEvent(this.blue),
      source: 'internal',
      emissionType: 'lifecycle',
    };

    const emitted: EventNodePayload[] = [initEvent.payload];

    await this.router.route(current, [], initEvent, 0);

    const result = await this.drainQueue(current);
    current = result.state;
    emitted.push(...result.emitted);

    // Add initialized contract to mark the document as initialized
    current = ensureInitializedContract(current, this.blue);

    // Return a mutable copy for external use
    return { state: mutable(current), emitted };
  }

  /**
   * Processes a batch of events against the document
   *
   * @param document - The document to process events against
   * @param incoming - List of event payloads to process
   * @returns Processing result with final state and emitted events
   */
  async processEvents(
    document: DocumentNode,
    incoming: EventNodePayload[]
  ): Promise<ProcessingResult> {
    let current = ensureCheckpointContracts(freeze(document), this.blue);
    const emitted: EventNodePayload[] = [];

    if (!isInitialized(current, this.blue)) {
      throw new Error('Document is not initialized');
    }

    for (const payload of incoming) {
      try {
        const externalEvent: EventNode = { payload, source: 'external' };
        await this.router.route(current, [], externalEvent, 0);

        const result = await this.drainQueue(current);
        current = result.state;
        emitted.push(...result.emitted);

        const checkpointPatches = this.checkpointCache.flush(current);
        if (checkpointPatches.length) {
          current = applyPatches(current, checkpointPatches);
        }
      } finally {
        this.checkpointCache.clear();
      }
    }

    // Return a mutable copy for external use
    return { state: mutable(current), emitted };
  }

  /**
   * Drains the task queue and applies all actions
   */
  private async drainQueue(document: DocumentNode): Promise<ProcessingResult> {
    let current = document;
    const emitted: EventNodePayload[] = [];
    const MAX_STEPS = 10_000;
    let steps = 0;

    while (this.queue.length) {
      if (++steps > MAX_STEPS) {
        throw new Error('Possible cycle – too many iterations');
      }

      const task = this.queue.pop()!;
      const { nodePath, contractName, contractNode, event } = task;

      const node = current.get(nodePath);
      if (!isDocumentNode(node) || !node.getContracts()?.[contractName])
        continue;
      if (!contractNode.getType()) continue;

      const cp = this.registry.get(contractNode.getType());
      if (!cp) {
        console.warn(`No processor registered for contract: ${contractName}`);
        continue;
      }

      const ctx = new InternalContext(
        () => current,
        task,
        this.blue,
        async (actions) => {
          // Process emitted events and apply patches to update the document
          for (const act of actions) {
            if (act.kind === 'patch') {
              // ───────────────────────────────────────────────
              // Cross-boundary write protection
              // ───────────────────────────────────────────────
              const embeddedPaths = collectEmbeddedPathSpecs(
                current,
                this.blue
              );

              for (const embeddedPath of embeddedPaths) {
                const touchedPaths =
                  act.patch.op === 'move' || act.patch.op === 'copy'
                    ? [act.patch.from, act.patch.path]
                    : [act.patch.path];

                const writerNodePath = ctx.getNodePath();
                const isEmbeddedTouching = touchedPaths.some((touchedPath) =>
                  isInside(touchedPath, embeddedPath.absPath)
                );
                const isWriterInside = isInside(
                  writerNodePath,
                  embeddedPath.absPath
                );
                const crossesBoundary = isEmbeddedTouching && !isWriterInside;

                if (crossesBoundary) {
                  throw new EmbeddedDocumentModificationError(
                    act.patch,
                    embeddedPath.absPath,
                    writerNodePath
                  );
                }
              }

              try {
                current = applyPatches(current, [act.patch]);
              } catch (err) {
                logPatchError(contractName, event, err);
                throw err;
              }
            } else if (act.kind === 'event') {
              emitted.push(act.event.payload);
              await this.router.route(current, [], act.event, task.key[5]);
            }
          }
        }
      );

      await cp.handle(event, contractNode, ctx, contractName);
      await ctx.flush();
    }

    return { state: current, emitted };
  }
}
