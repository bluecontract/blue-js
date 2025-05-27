import {
  ContractProcessor,
  DocumentNode,
  EventNode,
  HandlerTask,
} from '../types';
import { InternalContext } from '../context';
import { makePath } from '../utils/path';
import {
  // hasDocumentNodeOrder,
  // hasDocumentNodeType,
  isDocumentNode,
} from '../utils/typeGuard';
import { makeTaskKey } from '../queue/TaskKey';
import { TaskQueue } from '../queue/TaskQueue';
import { ContractRegistry } from '../registry/ContractRegistry';
import { EventTraceManager } from '../utils/EventTraceManager';
import type { Blue } from '../../Blue';
import { isBigNumber } from '../../../utils/typeGuards/isBigNumber';
import { isNullable } from '@blue-company/shared-utils';

/** Maximum recursion depth for inline adapter processing */
const MAX_INLINE_ADAPTER_DEPTH = 64;

/**
 * Routes events to matching contracts in the document tree
 */
export class EventRouter {
  private readonly traceManager: EventTraceManager;

  /**
   * Creates a new event router
   *
   * @param registry - Contract registry for looking up processors
   * @param queue - Task queue for scheduling handlers
   * @param getNextTaskId - Function to get the next task ID
   * @param getNextEventSeq - Function to get the next event sequence number
   */
  constructor(
    private readonly blue: Blue,
    private readonly registry: ContractRegistry,
    private readonly queue: TaskQueue,
    private readonly getNextTaskId: () => number,
    private readonly getNextEventSeq: () => number
  ) {
    this.traceManager = new EventTraceManager();
  }

  /**
   * Routes an event to matching contracts in the document
   *
   * @param doc - The document to route events in
   * @param pathSegments - Path segments to the current node
   * @param event - The event to route
   * @param afterTaskId - Minimum task ID to use
   * @param inlineDepth - Current adapter recursion depth
   */
  async route(
    doc: DocumentNode,
    pathSegments: string[],
    event: EventNode,
    afterTaskId: number,
    inlineDepth = 0
  ): Promise<void> {
    if (event.seq === undefined) {
      event.seq = this.getNextEventSeq();
    }

    if (pathSegments.length === 0) {
      if (event.dispatchPath) {
        const segs = event.dispatchPath.split('/').filter(Boolean);
        const cloned = { ...event };
        delete cloned.dispatchPath;
        return this.route(doc, segs, cloned, afterTaskId, inlineDepth);
      }
      if (
        event.source === 'channel' &&
        event.originNodePath &&
        event.originNodePath !== '/'
      ) {
        const segs = event.originNodePath?.split('/').filter(Boolean) ?? [];
        return this.route(doc, segs, event, afterTaskId, inlineDepth);
      }
    }

    const nodePath = makePath('/', pathSegments.join('/'));
    const node = doc.get(nodePath);

    if (!isDocumentNode(node)) return;

    await this.traverseContracts({
      doc,
      node,
      nodePath,
      event,
      afterTaskId,
      pathSegments,
      inlineDepth,
    });
  }

  /**
   * Traverses contracts at the current node and routes to matching ones
   */
  private async traverseContracts(args: {
    doc: DocumentNode;
    node: DocumentNode;
    nodePath: string;
    event: EventNode;
    afterTaskId: number;
    pathSegments: string[];
    inlineDepth: number;
  }): Promise<void> {
    const {
      doc,
      node,
      nodePath,
      event,
      afterTaskId,
      pathSegments,
      inlineDepth,
    } = args;

    // Skip events originating from other channel nodes
    if (this.shouldSkipForChannel(event, nodePath)) return;

    for (const [contractName, contractNode] of Object.entries(
      node.getContracts() ?? {}
    )) {
      if (!contractNode.getType()) continue;

      const cp = this.registry.get(contractNode.getType());
      if (!cp) {
        console.warn(`No processor registered for contract: ${contractName}`);
        continue;
      }

      const handlerTask: HandlerTask = {
        nodePath,
        contractName,
        contractNode,
        event,
      };

      const ctx = new InternalContext(() => doc, handlerTask, this.blue);
      if (!cp.supports(event, contractNode, ctx, contractName)) continue;

      // Dispatch based on processor role
      switch (cp.role) {
        case 'adapter':
          await this.processAdapter({
            cp,
            event,
            contractNode,
            ctx,
            contractName,
            doc,
            afterTaskId,
            inlineDepth,
          });
          break;
        case 'handler':
          this.scheduleHandler({
            contractNode,
            contractName,
            nodePath,
            event,
            depth: pathSegments.length,
            afterTaskId,
          });
          break;
        // Validators are ignored at enqueue step – they run inside handlers
        case 'validator':
          break;
      }
    }
  }

  /**
   * Processes an adapter contract and routes any emitted events
   */
  private async processAdapter(args: {
    cp: ContractProcessor;
    event: EventNode;
    contractNode: DocumentNode;
    ctx: InternalContext;
    contractName: string;
    doc: DocumentNode;
    afterTaskId: number;
    inlineDepth: number;
  }): Promise<void> {
    const {
      cp,
      event,
      contractNode,
      ctx,
      contractName,
      doc,
      afterTaskId,
      inlineDepth,
    } = args;

    if (inlineDepth >= MAX_INLINE_ADAPTER_DEPTH) {
      throw new Error('Adapter recursion limit reached');
    }

    const tracedEvent = this.traceManager.addHop(
      event,
      ctx.getTaskInfo()?.nodePath ?? '',
      contractName
    );

    await cp.handle(tracedEvent, contractNode, ctx, contractName);
    const batch = await ctx.flush();

    // Adapters are **not** allowed to patch the document (safety invariant)
    const illegal = batch.find((a) => a.kind === 'patch');
    if (illegal) {
      throw new Error(
        `Contract "${contractName}" (adapter) attempted to patch the document`
      );
    }

    const emitted = batch.filter((a) => a.kind === 'event');

    // Re‑enqueue any events emitted by the adapter
    for (const a of emitted) {
      await this.route(doc, [], a.event, afterTaskId, inlineDepth + 1);
    }
  }

  /**
   * Schedules a handler contract for future execution
   */
  private scheduleHandler(args: {
    contractNode: DocumentNode;
    contractName: string;
    nodePath: string;
    event: EventNode;
    depth: number;
    afterTaskId: number;
  }): void {
    const { contractNode, contractName, nodePath, event, depth, afterTaskId } =
      args;

    const contractNodeType = contractNode.getType();
    if (!contractNodeType) {
      console.warn(`Contract node type is not defined for: ${contractName}`);
      return;
    }

    const typePriority = this.registry.orderOf(contractNodeType);
    const contractNodeOrder = contractNode.get('/order');
    const contractOrder = isBigNumber(contractNodeOrder)
      ? contractNodeOrder.toNumber()
      : 0;
    const taskId = this.getNextTaskId() + afterTaskId;

    const key = makeTaskKey(
      depth,
      event.seq!,
      typePriority,
      contractOrder,
      contractName,
      taskId
    );

    const tracedEvent = this.traceManager.addHop(event, nodePath, contractName);

    this.queue.push({
      key,
      nodePath,
      contractName,
      contractNode,
      event: tracedEvent,
    });
  }

  /**
   * Checks if an event should be skipped because it came from another channel node
   */
  private shouldSkipForChannel(event: EventNode, nodePath: string): boolean {
    return (
      event.source === 'channel' &&
      !!event.originNodePath &&
      event.originNodePath !== nodePath
    );
  }
}
