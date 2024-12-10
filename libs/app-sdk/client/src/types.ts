import { AppSDK } from './sdk';

export type SDKCommandInitArgs = Parameters<typeof AppSDK.getInstance>;

export type SDKCommandInit = ['init', ...SDKCommandInitArgs];

export type SDKCommand = SDKCommandInit;

export type SDKFunction = (...args: SDKCommand) => void;

export type SDKDataLayer = {
  push: (args: SDKCommand) => void;
} & Array<SDKCommand>;
