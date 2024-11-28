import { SubscriptionHandle } from '../api/types';
import {
  ListContractsQueryVariables,
  GetContractDetailsQueryVariables,
} from '@blue-company/app-sdk-core';

export interface ContractState {
  type?: 'Order' | 'Product' | 'Shop' | string;
  participants?: { [key: string]: any };
  properties?: { [key: string]: any };
  messaging?: {
    participants?: { [key: string]: any };
  };
  subscriptions?: { [key: string]: any };
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
  listContracts?(variables: ListContractsQueryVariables): Promise<Contract[]>;
  getContractDetails?(
    variables: GetContractDetailsQueryVariables
  ): Promise<Contract>;
  subscribeByType?(
    contractType: string,
    variables: ListContractsQueryVariables,
    callback: (contract: Contract) => void
  ): Promise<SubscriptionHandle>;
  subscribeById?(
    variables: GetContractDetailsQueryVariables,
    callback: (contract: Contract) => void
  ): Promise<SubscriptionHandle>;
}
