import { createRequire } from 'node:module';

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
import {
  EmbeddedDocumentModificationError,
  MustUnderstandFailure,
  ProcessorFatalError,
} from './utils/exceptions';
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
import { cloneAndFreezeEventPayload } from './utils/event';
import {
  blueIds,
  ChannelEventCheckpointSchema,
  InitializedMarkerSchema,
  ProcessEmbeddedSchema,
} from '@blue-repository/core-dev';

type CoreRepositoryModule = {
  blueIds?: Record<string, string>;
  ProcessingTerminatedMarkerSchema?: unknown;
  schema?: { ProcessingTerminatedMarkerSchema?: unknown };
};

const requireFromMeta = createRequire(import.meta.url);

const PROCESSING_TERMINATED_RESOURCES = (() => {
  try {
    const core = requireFromMeta(
      '@blue-repository/core'
    ) as CoreRepositoryModule;
    return {
      blueId: core.blueIds?.['Processing Terminated Marker'],
      schema:
        core.ProcessingTerminatedMarkerSchema ??
        core.schema?.ProcessingTerminatedMarkerSchema,
    };
  } catch {
    return { blueId: undefined, schema: undefined } as const;
  }
})();

const TYPE_CHECK_OPTIONS = { checkSchemaExtensions: true } as const;

type ReservedContractKey = 'embedded' | 'initialized' | 'terminated' | 'checkpoint';

type ReservedContractRule = {
  readonly key: ReservedContractKey;
  readonly description: string;
  readonly schema?: unknown;
  readonly expectedBlueId?: string;
  readonly typeNames?: readonly string[];
  readonly skipProcessorCheck?: boolean;
};

const RESERVED_CONTRACT_RULES: Record<ReservedContractKey, ReservedContractRule> = {
  embedded: {
    key: 'embedded',
    description: 'Process Embedded',
    schema: ProcessEmbeddedSchema,
    expectedBlueId: blueIds['Process Embedded'],
  },
  initialized: {
    key: 'initialized',
    description: 'Initialized Marker',
    schema: InitializedMarkerSchema,
    expectedBlueId: blueIds['Initialized Marker'],
    typeNames: ['Initialized Marker', 'Processing Initialized Marker'],
    skipProcessorCheck: true,
  },
  terminated: {
    key: 'terminated',
    description: 'Processing Terminated Marker',
    schema: PROCESSING_TERMINATED_RESOURCES.schema,
    expectedBlueId: PROCESSING_TERMINATED_RESOURCES.blueId,
    typeNames: ['Processing Terminated Marker'],
    skipProcessorCheck: true,
  },
  checkpoint: {
    key: 'checkpoint',
    description: 'Channel Event Checkpoint',
    schema: ChannelEventCheckpointSchema,
    expectedBlueId: blueIds['Channel Event Checkpoint'],
  },
};

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
    const frozenInput = freeze(document);

    try {
      this.validateDocumentContracts(frozenInput);
    } catch (error) {
      if (error instanceof MustUnderstandFailure) {
        return this.capabilityFailureResult(
          mutable(frozenInput),
          error.message ?? null
        );
      }
      throw error;
    }

    let current = ensureCheckpointContracts(frozenInput, this.blue);

    // Emit the Document Processing Initiated event
    const initEvent: EventNode = {
      payload: cloneAndFreezeEventPayload(
        createDocumentProcessingInitiatedEvent(this.blue)
      ),
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
    return this.successResult(mutable(current), emitted);
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
    const frozenInput = freeze(document);

    try {
      this.validateDocumentContracts(frozenInput);
    } catch (error) {
      if (error instanceof MustUnderstandFailure) {
        return this.capabilityFailureResult(
          mutable(frozenInput),
          error.message ?? null
        );
      }
      throw error;
    }

    let current = ensureCheckpointContracts(frozenInput, this.blue);
    const emitted: EventNodePayload[] = [];

    if (!isInitialized(current, this.blue)) {
      throw new Error('Document is not initialized');
    }

    for (const payload of incoming) {
      try {
        const externalEvent: EventNode = {
          payload: cloneAndFreezeEventPayload(payload),
          source: 'external',
        };
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
    return this.successResult(mutable(current), emitted);
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

      const task = this.queue.pop();
      if (!task) {
        continue;
      }
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

    return this.successResult(current, emitted);
  }

  private successResult(
    state: DocumentNode,
    emitted: EventNodePayload[]
  ): ProcessingResult {
    return {
      state,
      emitted,
      capabilityFailure: false,
      failureReason: null,
    };
  }

  private capabilityFailureResult(
    state: DocumentNode,
    reason: string | null
  ): ProcessingResult {
    return {
      state,
      emitted: [],
      capabilityFailure: true,
      failureReason: reason ?? null,
    };
  }

  private validateDocumentContracts(document: DocumentNode): void {
    this.visitScopeContracts(document, ({ scopePath, contractName, contract }) => {
      const pointer = this.contractPointer(scopePath, contractName);
      const reservedRule = Object.hasOwn(RESERVED_CONTRACT_RULES, contractName)
        ? RESERVED_CONTRACT_RULES[contractName as ReservedContractKey]
        : undefined;

      if (reservedRule) {
        if (!this.matchesReservedContract(contract, reservedRule)) {
          throw new ProcessorFatalError(
            `Reserved contract '${contractName}' at ${pointer} must be a ${reservedRule.description}`
          );
        }
        if (!reservedRule.skipProcessorCheck) {
          this.ensureProcessorRegistered(contract, pointer);
        }
        return;
      }

      this.ensureProcessorRegistered(contract, pointer);
    });
  }

  private visitScopeContracts(
    root: DocumentNode,
    visitor: (args: {
      scopePath: string;
      contractName: string;
      contract: DocumentNode;
    }) => void
  ): void {
    const stack: Array<{ node: DocumentNode; path: string }> = [
      { node: root, path: '/' },
    ];
    const visited = new Set<DocumentNode>();

    while (stack.length) {
      const entry = stack.pop();
      if (!entry) continue;
      const { node, path } = entry;
      if (visited.has(node)) continue;
      visited.add(node);

      const contracts = node.getContracts() as
        | Record<string, unknown>
        | undefined;
      if (contracts) {
        for (const [name, maybeContract] of Object.entries(contracts)) {
          if (!isDocumentNode(maybeContract)) {
            throw new ProcessorFatalError(
              `Contract '${name}' at ${this.contractPointer(
                path,
                name
              )} must be a document`
            );
          }
          visitor({ scopePath: path, contractName: name, contract: maybeContract });
        }
      }

      const properties = node.getProperties();
      if (properties) {
        for (const [propName, value] of Object.entries(properties)) {
          if (propName === 'contracts') continue;
          if (isDocumentNode(value)) {
            stack.push({
              node: value,
              path: this.joinPointer(path, propName),
            });
          }
        }
      }

      const items = node.getItems();
      if (Array.isArray(items)) {
        items.forEach((item, index) => {
          if (isDocumentNode(item)) {
            stack.push({
              node: item,
              path: this.joinPointer(path, String(index)),
            });
          }
        });
      }
    }
  }

  private matchesReservedContract(
    contract: DocumentNode,
    rule: ReservedContractRule
  ): boolean {
    if (rule.schema) {
      try {
        if (this.blue.isTypeOf(contract, rule.schema as never, TYPE_CHECK_OPTIONS)) {
          return true;
        }
      } catch {
        // fall through to other checks
      }
    }

    const typeNode = contract.getType();
    if (!typeNode) {
      return false;
    }

    const blueId = typeNode.getBlueId();
    if (rule.expectedBlueId && blueId === rule.expectedBlueId) {
      return true;
    }

    if (rule.typeNames?.length) {
      const inlineValue = typeNode.getValue();
      if (typeof inlineValue === 'string' && rule.typeNames.includes(inlineValue)) {
        return true;
      }
      const nameProperty = typeNode.getProperties()?.name;
      const nameValue = nameProperty?.getValue?.();
      if (typeof nameValue === 'string' && rule.typeNames.includes(nameValue)) {
        return true;
      }
    }

    return false;
  }

  private ensureProcessorRegistered(contract: DocumentNode, pointer: string): void {
    const typeNode = contract.getType();
    const blueId = typeNode?.getBlueId();
    if (blueId && this.registry.has(blueId)) {
      return;
    }

    if (!blueId) {
      throw new MustUnderstandFailure(
        `Unsupported contract at ${pointer}: missing contract type`
      );
    }

    throw new MustUnderstandFailure(
      `Unsupported contract type ${blueId} at ${pointer}`
    );
  }

  private contractPointer(scopePath: string, contractName: string): string {
    return this.joinPointer(scopePath, `contracts/${contractName}`);
  }

  private joinPointer(base: string, segment: string): string {
    const normalizedBase = base === '/' ? '' : base.replace(/\/+$/, '');
    const normalizedSegment = segment.replace(/^\/+/, '');
    const combined = [normalizedBase, normalizedSegment]
      .filter(Boolean)
      .join('/');
    return combined ? `/${combined}` : '/';
  }
}
