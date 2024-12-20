import { BaseMessage } from './base';
import { BaseAsyncPayload, AsyncResponseMessagePayload } from './asyncPayload';

export type { BaseMessage } from './base';
export * from './asyncPayload';

export type InitMessage = BaseMessage & {
  type: 'init';
  payload: {
    appId: string;
    initialPathname?: string;
  };
};

export type InitResponseMessage = BaseMessage & {
  type: 'init-response';
  payload: {
    appId: string;
    version?: string;
  };
};

/**
 * Sent by the client to the host to indicate that the client is ready
 */
export type ReadyMessage = BaseMessage & {
  type: 'ready';
  payload: {
    pathname?: string;
  };
};

export type PageHeightMessage = BaseMessage & {
  type: 'page-height';
  payload: {
    height: number;
  };
};

export type RouteChangeMessage = BaseMessage & {
  type: 'route-change';
  payload: {
    pathname: string;
  };
};

export type CustomMessage = BaseMessage & {
  type: 'custom';
  payload: unknown;
};

export type AsyncRequestMessage<T extends BaseAsyncPayload = BaseAsyncPayload> =
  BaseMessage & {
    type: 'async-request';
    payload: T;
  };

export type AsyncResponseMessage<
  T extends AsyncResponseMessagePayload = AsyncResponseMessagePayload
> = BaseMessage & {
  type: 'async-response';
  payload: T;
};

export type Message =
  | InitMessage
  | InitResponseMessage
  | ReadyMessage
  | PageHeightMessage
  | RouteChangeMessage
  | CustomMessage
  | AsyncRequestMessage
  | AsyncResponseMessage;
