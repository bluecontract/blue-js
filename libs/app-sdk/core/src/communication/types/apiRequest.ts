import { BaseMessage } from './base';

export type BaseApiRequestPayload = {
  requestId?: string;
};

export type GetContractDetailsQueryVariables = {
  contractId: string;
};

type GetContractDetailsQuery = BaseApiRequestPayload & {
  type: 'get-contract-details';
  variables: GetContractDetailsQueryVariables;
};

export type ListContractsQueryVariables = {
  type?: string;
  participants?: { [key: string]: unknown };
  properties?: { [key: string]: unknown };
};

type ListContractsQuery = BaseApiRequestPayload & {
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
