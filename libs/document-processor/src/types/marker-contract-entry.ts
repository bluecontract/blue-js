import type { MarkerContract } from '../model/index.js';

export interface MarkerContractEntry {
  readonly key: string;
  readonly contract: MarkerContract;
  readonly blueId: string;
}
