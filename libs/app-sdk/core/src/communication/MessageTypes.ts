export interface BaseMessage {
  type: string;
  payload: unknown;
}

export type Message =
  | PageHeightMessage
  | RouteChangeMessage
  | CustomMessage
  | ApiRequestMessage
  | ApiResponseMessage;

export interface PageHeightMessage extends BaseMessage {
  type: 'page-height';
  payload: {
    height: number;
  };
}

export interface RouteChangeMessage extends BaseMessage {
  type: 'route-change';
  payload: {
    path: string;
  };
}

export interface CustomMessage extends BaseMessage {
  type: 'custom';
  payload: unknown;
}

export type BaseApiRequestPayload = {
  requestId?: string;
};

export type ListContractsQueryVariables = {
  type?: string;
  participants?: { [key: string]: any };
  properties?: { [key: string]: any };
};

export type GetContractDetailsQueryVariables = {
  contractId: string;
};

export type GetContractDetailsQuery = BaseApiRequestPayload & {
  type: 'get-contract-details';
  variables: GetContractDetailsQueryVariables;
};

export type ListContractsQuery = BaseApiRequestPayload & {
  type: 'list-contracts';
  variables: ListContractsQueryVariables;
};
export type ApiRequestMessagePayload =
  | GetContractDetailsQuery
  | ListContractsQuery;

export type ApiRequestMessage<
  T extends BaseApiRequestPayload = BaseApiRequestPayload
> = BaseMessage & {
  type: 'api-request';
  payload: T;
};

export interface ApiResponseMessage extends BaseMessage {
  type: 'api-response';
  payload: {
    requestId: string;
    data?: unknown;
    error?: string;
  };
}
