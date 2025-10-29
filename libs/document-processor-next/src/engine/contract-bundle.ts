import { blueIds } from '@blue-repository/core';

import { KEY_CHECKPOINT } from '../constants/processor-contract-constants.js';
import type {
  ChannelContract,
  HandlerContract,
  MarkerContract,
  ProcessEmbeddedMarker,
  ChannelEventCheckpoint,
} from '../model/index.js';

type StoredChannel = {
  readonly key: string;
  readonly contract: ChannelContract;
  readonly blueId: string;
};

type StoredMarker = {
  readonly key: string;
  readonly contract: MarkerContract;
  readonly blueId: string;
};

type StoredHandler = {
  readonly key: string;
  readonly contract: HandlerContract;
  readonly blueId: string;
};

const CHANNEL_EVENT_CHECKPOINT_BLUE_ID = blueIds['Channel Event Checkpoint'];

function contractOrder(contract: { readonly order?: number | null }): number {
  return typeof contract.order === 'number' ? contract.order : 0;
}

export class ChannelBinding {
  constructor(
    private readonly bindingKey: string,
    private readonly bindingContract: ChannelContract,
    private readonly bindingBlueId: string
  ) {}

  key(): string {
    return this.bindingKey;
  }

  contract(): ChannelContract {
    return this.bindingContract;
  }

  blueId(): string {
    return this.bindingBlueId;
  }

  order(): number {
    return contractOrder(this.bindingContract);
  }
}

export class HandlerBinding {
  constructor(
    private readonly bindingKey: string,
    private readonly bindingContract: HandlerContract,
    private readonly bindingBlueId: string
  ) {}

  key(): string {
    return this.bindingKey;
  }

  contract(): HandlerContract {
    return this.bindingContract;
  }

  blueId(): string {
    return this.bindingBlueId;
  }

  order(): number {
    return contractOrder(this.bindingContract);
  }
}

export class ContractBundle {
  private checkpointDeclared: boolean;

  private constructor(
    private readonly channels: Map<string, StoredChannel>,
    private readonly handlersByChannel: Map<string, StoredHandler[]>,
    private readonly markerStore: Map<string, StoredMarker>,
    private readonly embeddedPathsInternal: readonly string[],
    checkpointDeclared: boolean
  ) {
    this.checkpointDeclared = checkpointDeclared;
  }

  static fromComponents(
    channels: Map<string, StoredChannel>,
    handlersByChannel: Map<string, StoredHandler[]>,
    markerStore: Map<string, StoredMarker>,
    embeddedPaths: readonly string[],
    checkpointDeclared: boolean
  ): ContractBundle {
    return new ContractBundle(
      channels,
      handlersByChannel,
      markerStore,
      embeddedPaths,
      checkpointDeclared
    );
  }

  static builder(): ContractBundleBuilder {
    return new ContractBundleBuilder();
  }

  static empty(): ContractBundle {
    return ContractBundle.builder().build();
  }

  markers(): Map<string, MarkerContract> {
    return new Map(
      Array.from(this.markerStore.entries(), ([key, entry]) => [
        key,
        entry.contract,
      ])
    );
  }

  marker(key: string): MarkerContract | undefined {
    return this.markerStore.get(key)?.contract;
  }

  markerEntries(): Array<[string, MarkerContract]> {
    return Array.from(this.markerStore.entries(), ([key, entry]) => [
      key,
      entry.contract,
    ]);
  }

  embeddedPaths(): readonly string[] {
    return this.embeddedPathsInternal;
  }

  hasCheckpoint(): boolean {
    return this.checkpointDeclared;
  }

  registerCheckpointMarker(checkpoint: ChannelEventCheckpoint): void {
    if (this.checkpointDeclared) {
      throw new Error(
        'Duplicate Channel Event Checkpoint markers detected in same contracts map'
      );
    }
    this.markerStore.set(KEY_CHECKPOINT, {
      key: KEY_CHECKPOINT,
      contract: checkpoint,
      blueId: CHANNEL_EVENT_CHECKPOINT_BLUE_ID,
    });
    this.checkpointDeclared = true;
  }

  handlersFor(channelKey: string): HandlerBinding[] {
    const handlers = this.handlersByChannel.get(channelKey);
    if (!handlers || handlers.length === 0) {
      return [];
    }
    return [...handlers]
      .map(
        (entry) => new HandlerBinding(entry.key, entry.contract, entry.blueId)
      )
      .sort((a, b) => {
        const orderDiff = a.order() - b.order();
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.key().localeCompare(b.key());
      });
  }

  channelsOfType(...blueIds: readonly string[]): ChannelBinding[] {
    const filter = blueIds.length > 0 ? new Set(blueIds) : null;
    const bindings = Array.from(this.channels.values())
      .filter((entry) => !filter || filter.has(entry.blueId))
      .map(
        (entry) => new ChannelBinding(entry.key, entry.contract, entry.blueId)
      );
    bindings.sort((a, b) => {
      const orderDiff = a.order() - b.order();
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a.key().localeCompare(b.key());
    });
    return bindings;
  }
}

export class ContractBundleBuilder {
  private readonly channels = new Map<string, StoredChannel>();
  private readonly handlersByChannel = new Map<string, StoredHandler[]>();
  private readonly markerStore = new Map<string, StoredMarker>();
  private embeddedPaths: string[] = [];
  private embeddedDeclared = false;
  private checkpointDeclared = false;

  addChannel(key: string, contract: ChannelContract, blueId: string): this {
    this.channels.set(key, { key, contract, blueId });
    return this;
  }

  addHandler(key: string, contract: HandlerContract, blueId: string): this {
    const channelKey = contract.channel;
    if (!channelKey) {
      throw new Error(`Handler ${key} must declare channel`);
    }
    const list = this.handlersByChannel.get(channelKey) ?? [];
    list.push({ key, contract, blueId });
    this.handlersByChannel.set(channelKey, list);
    return this;
  }

  setEmbedded(embedded: ProcessEmbeddedMarker): this {
    if (this.embeddedDeclared) {
      throw new Error(
        'Multiple Process Embedded markers detected in same contracts map'
      );
    }
    this.embeddedDeclared = true;
    this.embeddedPaths = embedded.paths ? [...embedded.paths] : [];
    return this;
  }

  addMarker(key: string, contract: MarkerContract, blueId: string): this {
    if (key === KEY_CHECKPOINT && blueId !== CHANNEL_EVENT_CHECKPOINT_BLUE_ID) {
      throw new Error(
        "Reserved key 'checkpoint' must contain a Channel Event Checkpoint"
      );
    }
    if (blueId === CHANNEL_EVENT_CHECKPOINT_BLUE_ID) {
      if (key !== KEY_CHECKPOINT) {
        throw new Error(
          `Channel Event Checkpoint must use reserved key 'checkpoint' at key '${key}'`
        );
      }
      if (this.checkpointDeclared) {
        throw new Error(
          'Duplicate Channel Event Checkpoint markers detected in same contracts map'
        );
      }
      this.checkpointDeclared = true;
    }
    this.markerStore.set(key, { key, contract, blueId });
    return this;
  }

  build(): ContractBundle {
    return ContractBundle.fromComponents(
      new Map(this.channels),
      new Map(
        Array.from(this.handlersByChannel.entries(), ([key, list]) => [
          key,
          [...list],
        ])
      ),
      new Map(this.markerStore),
      [...this.embeddedPaths],
      this.checkpointDeclared
    );
  }
}
