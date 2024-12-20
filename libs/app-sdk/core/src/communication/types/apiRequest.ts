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

export type MethodDefinitionParam = {
  name: string;
  type: string;
  constraints: {
    required: boolean;
  };
};

export type MethodDefinition = {
  name: string;
  type: 'Method Definition';
  params: MethodDefinitionParam[];
  returns: {
    type: string;
  };
};

export type BaseApiRequestPayload = {
  requestId: string;
};

export type GetContractDetailsQueryVariables = {
  contractId: string;
};

export type ListContractsQueryVariables = {
  type?: string;
  participants?: { [key: string]: unknown };
  properties?: { [key: string]: unknown };
};

export type CallMethodMutationVariables = {
  agentId: string;
  methodDefinition: MethodDefinition;
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

export type ApiRequestMessagePayload =
  | CallMethodMutation
  | InitializeAgentQuery;

export type ApiRequestMessage<
  T extends BaseApiRequestPayload = BaseApiRequestPayload
> = BaseMessage & {
  type: 'api-request';
  payload: T;
};
