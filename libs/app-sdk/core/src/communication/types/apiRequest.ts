import { BaseMessage } from './base';

type Primitive = string | number | boolean | null;

type ComparisonOperators<T> = {
  $eq?: T;
  $ne?: T;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
  $in?: T[];
  $nin?: T[];
  $regex?: T extends string ? string : never;
  // Add more operators as needed
};

type FilterQuery<T> = T extends Primitive
  ? ComparisonOperators<T>
  : T extends Array<infer U>
  ? ComparisonOperators<U> | FilterQuery<U>
  : {
      [P in keyof T]?: FilterQuery<T[P]> | ComparisonOperators<T[P]>;
    };

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
  agentId: string;
  methodDefinition: unknown;
  params: unknown[];
};

type CallMethodMutation = BaseApiRequestPayload & {
  type: 'call-method';
  variables: CallMethodMutationVariables;
};

export type InitializeAgentQueryVariables = {
  contract: FilterQuery<unknown>;
};

type InitializeAgentQuery = BaseApiRequestPayload & {
  type: 'initialize-agent';
  variables: InitializeAgentQueryVariables;
};

/**
 * New API for getting the latest state of a BlueObject
 */
export type GetLatestBlueObjectStateQueryVariables = {
  blueObjectId: string;
};

type GetLatestBlueObjectStateQuery = BaseApiRequestPayload & {
  type: 'get-latest-blue-object-state';
  variables: GetLatestBlueObjectStateQueryVariables;
};

export type ApiRequestMessagePayload =
  | GetContractDetailsQuery
  | GetLatestBlueObjectStateQuery
  | ListContractsQuery
  | CallMethodMutation
  | InitializeAgentQuery;

export type ApiRequestMessage<
  T extends BaseApiRequestPayload = BaseApiRequestPayload
> = BaseMessage & {
  type: 'api-request';
  payload: T;
};
