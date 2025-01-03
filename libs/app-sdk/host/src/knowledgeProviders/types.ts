import { SubscriptionHandle } from '../api/types';
import {
  ListContractsQueryVariables,
  GetContractDetailsQueryVariables,
  CallMethodMutationVariables,
  InitializeAgentQueryVariables,
} from '@blue-company/app-sdk-core';

export interface ContractState {
  type?: 'Order' | 'Product' | 'Shop' | string;
  participants?: { [key: string]: unknown };
  properties?: { [key: string]: unknown };
  messaging?: {
    participants?: { [key: string]: unknown };
  };
  subscriptions?: { [key: string]: unknown };
}

export interface ContractEpoch {
  created?: string;
  epoch?: number;
  contractInstance?: {
    contractState?: ContractState;
  };
}

export interface Contract {
  id: string;
  created?: string;
  epochs: ContractEpoch[];
}

export interface KnowledgeProvider {
  readonly name: string;
  authenticate?(): Promise<void>;
  initializeAgent?(variables: InitializeAgentQueryVariables): Promise<unknown>;
  subscribeByType?(
    contractType: string,
    variables: ListContractsQueryVariables,
    callback: (contract: Contract) => void
  ): Promise<SubscriptionHandle>;
  subscribeById?(
    variables: GetContractDetailsQueryVariables,
    callback: (contract: Contract) => void
  ): Promise<SubscriptionHandle>;
  callMethod?(variables: CallMethodMutationVariables): Promise<unknown>;
}
