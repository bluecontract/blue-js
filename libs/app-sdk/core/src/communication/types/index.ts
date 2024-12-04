import { BaseMessage } from './base';
import { ApiRequestMessage } from './apiRequest';

export type { BaseMessage } from './base';
export type {
  ApiRequestMessage,
  ApiRequestMessagePayload,
  ListContractsQueryVariables,
  GetContractDetailsQueryVariables,
} from './apiRequest';

export type InitMessage = BaseMessage & {
  type: 'init';
  payload: {
    appId: string;
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
    path: string;
  };
};

export type CustomMessage = BaseMessage & {
  type: 'custom';
  payload: unknown;
};

export type ApiResponseMessage = BaseMessage & {
  type: 'api-response';
  payload: {
    requestId: string;
    data?: unknown;
    error?: string;
  };
};

export type Message =
  | InitMessage
  | InitResponseMessage
  | ReadyMessage
  | PageHeightMessage
  | RouteChangeMessage
  | CustomMessage
  | ApiRequestMessage
  | ApiResponseMessage;
