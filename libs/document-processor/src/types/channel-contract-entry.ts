import type { BlueNode } from '@blue-labs/language';
import type { ChannelContract } from '../model/index.js';

export interface ChannelContractEntry {
  readonly key: string;
  readonly contract: ChannelContract;
  readonly blueId: string;
  readonly node: BlueNode;
}
