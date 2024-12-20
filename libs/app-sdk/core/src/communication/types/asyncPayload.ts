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

export type BaseAsyncPayload = {
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

type CallMethodMutation = BaseAsyncPayload & {
  type: 'call-method';
  variables: CallMethodMutationVariables;
};

export type InitializeAgentQueryVariables = {
  contract: Record<string, unknown>;
};

type InitializeAgentQuery = BaseAsyncPayload & {
  type: 'initialize-agent';
  variables: InitializeAgentQueryVariables;
};

export type InitializeAgentQueryResponse = {
  agentId: string;
};

export type AsyncRequestMessagePayload =
  | CallMethodMutation
  | InitializeAgentQuery;

export type AsyncResponseMessagePayload<T = unknown> = BaseAsyncPayload & {
  data?: T;
  error?: string;
};

export type AsyncResponsePayloadData<
  TType = AsyncRequestMessagePayload['type']
> = TType extends 'initialize-agent' ? InitializeAgentQueryResponse : unknown;
