import {
  Blue,
  BlueNode,
  BlueNodePatch,
  ResolvedBlueNode,
} from '@blue-labs/language';

// ---------------------------------------------------------------------------
// ⚙️  Core type definitions
// ---------------------------------------------------------------------------

export type BlueId = string;

export type DocumentNode = BlueNode;

export type EventNodePayload = BlueNode | ResolvedBlueNode;

export interface EventNode<Payload = EventNodePayload> {
  payload: Payload;
  source?: 'channel' | 'external' | 'internal';
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
  emitted: EventNodePayload[];
}

export type ContractRole = 'adapter' | 'validator' | 'handler' | 'marker';

// ---------------------------------------------------------------------------
// 🔌  ContractProcessor interface
// ---------------------------------------------------------------------------
export interface ContractProcessor {
  readonly contractType: string;
  readonly contractBlueId: BlueId;
  readonly role: ContractRole;
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
  | { kind: 'patch'; patch: BlueNodePatch }
  | { kind: 'event'; event: EventNode };

export type BlueNodeGetResult = ReturnType<typeof BlueNode.prototype.get>;

// ---------------------------------------------------------------------------
// 🧭  ProcessingContext – helpers exposed to processors
// ---------------------------------------------------------------------------
export type ProcessingContext = {
  get(path: string): BlueNodeGetResult;
  addPatch(patch: BlueNodePatch): void;
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
