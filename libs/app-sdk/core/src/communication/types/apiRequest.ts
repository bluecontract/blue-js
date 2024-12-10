import { BaseMessage } from './base';

export type BaseApiRequestPayload = {
  requestId: string;
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

export type CallMethodMutationVariables = {
  // contractId: string;
  methodDefinition: unknown;
  // params: unknown[];
};

type CallMethodMutation = BaseApiRequestPayload & {
  type: 'call-method';
  variables: CallMethodMutationVariables;
};

export type ApiRequestMessagePayload =
  | GetContractDetailsQuery
  | ListContractsQuery
  | CallMethodMutation;

export type ApiRequestMessage<
  T extends BaseApiRequestPayload = BaseApiRequestPayload
> = BaseMessage & {
  type: 'api-request';
  payload: T;
};
