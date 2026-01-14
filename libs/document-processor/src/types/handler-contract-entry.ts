import type { HandlerContract } from '../model/index.js';

export interface HandlerContractEntry {
  readonly key: string;
  readonly contract: HandlerContract;
  readonly blueId: string;
}
