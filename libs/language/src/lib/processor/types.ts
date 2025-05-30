import { Blue } from '../Blue';
import { BigDecimalNumber } from '../model/BigDecimalNumber';
import { BigIntegerNumber } from '../model/BigIntegerNumber';
import { BlueNode } from '../model/Node';

// ---------------------------------------------------------------------------
// ⚙️  Core type definitions
// ---------------------------------------------------------------------------

export type BlueId = string;

export type DocumentNode = BlueNode;

export interface EventNodePayload {
  type?: string;
  [key: string]: unknown;
}

export interface EventNode<Payload = EventNodePayload> {
  payload: Payload;
  source?: 'channel' | 'external';
  /** Absolute path of the document node that emitted this event */
  originNodePath?: string;

  /** Channel of the node that emitted this event */
  channelName?: string;

  /** Absolute path that hints the router where to start */
  dispatchPath?: string;

  /** Sequence number for event ordering */
  seq?: number;

  /** The very first event in the chain that led to this one */
  rootEvent?: EventNode;

  /** Linear path trace: each hop = "<absNodePath>#<contractName>" */
  trace?: string[];
}

export interface ProcessingResult {
  /** Final document state */
  state: DocumentNode;

  /** All emitted events */
  emitted: EventNode[];
}

/**
 * JSON-Patch operation as defined in RFC-6902
 * This matches the Operation types from fast-json-patch
 */
export type Patch =
  | { op: 'add'; path: string; val: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; val: unknown }
  | { op: 'move'; path: string; from: string }
  | { op: 'copy'; path: string; from: string };

export type ContractRole = 'adapter' | 'validator' | 'handler';

// ---------------------------------------------------------------------------
// 🔌  ContractProcessor interface
// ---------------------------------------------------------------------------
export interface ContractProcessor {
  readonly contractType: string;
  readonly contractBlueId: BlueId;
  readonly role: ContractRole;
  init?(node: DocumentNode): Promise<EventNode[]> | EventNode[];
  supports(
    evt: EventNode,
    contractNode: DocumentNode,
    ctx: ProcessingContext,
    contractName: string
  ): boolean;
  handle(
    evt: EventNode,
    contractNode: DocumentNode,
    ctx: ProcessingContext,
    contractName: string
  ): void;
}

export type ProcessingAction =
  | { kind: 'patch'; patch: Patch }
  | { kind: 'event'; event: EventNode };

// ---------------------------------------------------------------------------
// 🧭  ProcessingContext – helpers exposed to processors
// ---------------------------------------------------------------------------
export type ProcessingContext = {
  get(
    path: string
  ):
    | BlueNode
    | string
    | boolean
    | BigIntegerNumber
    | BigDecimalNumber
    | null
    | undefined;
  addPatch(patch: Patch): void;
  getNodePath(): string;
  resolvePath(path: string): string;

  /**
   * Emit an event for immediate processing
   * @param event Event to be processed immediately
   */
  emitEvent(event: EventNode): void;

  /**
   * Flush all pending patches and events
   */
  flush(): Promise<ProcessingAction[]>;

  /**
   * Get the Blue instance
   * @returns The Blue instance
   */
  getBlue(): Blue;

  /* TODO: Move to a separate interface */

  /**
   * Load external module
   * @param url URL of the module to load
   */
  loadExternalModule(url: string): Promise<string>;

  /**
   * Load blue content
   * @param blueId ID of the blue to load
   */
  loadBlueContent(blueId: string): Promise<string>;
};

export interface HandlerTask {
  nodePath: string;
  contractName: string;
  contractNode: DocumentNode;
  event: EventNode;
}

export interface Task extends HandlerTask {
  key: [number, number, number, number, string, number]; // [0:-depth, 1:seq, 2:contractTypePriority, 3:contractOrder, 4:contractName, 5:taskId]
}
