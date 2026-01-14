import type { ChannelContract } from '../model/index.js';

export interface ChannelContractEntry {
  readonly key: string;
  readonly contract: ChannelContract;
  readonly blueId: string;
}
