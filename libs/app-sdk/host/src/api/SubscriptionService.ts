import { KnowledgeProviderManager } from '../knowledgeProviders/Manager';
import { Contract } from '../knowledgeProviders/types';
import {
  ListContractsQueryVariables,
  GetContractDetailsQueryVariables,
} from '@blue-company/app-sdk-core';
import { SubscriptionHandle } from './types';

export class SubscriptionService {
  constructor(private providerManager: KnowledgeProviderManager) {}

  async subscribeByType(
    contractType: string,
    query: ListContractsQueryVariables,
    callback: (contract: Contract) => void
  ): Promise<SubscriptionHandle> {
    const listeners: SubscriptionHandle[] = [];

    for (const provider of this.providerManager.getProviders()) {
      if (!provider.subscribeByType) {
        continue;
      }

      const handle = await provider.subscribeByType(
        contractType,
        query,
        callback
      );
      listeners.push(handle);
    }

    return {
      unsubscribe: () => {
        listeners.forEach((handle) => handle.unsubscribe());
      },
    };
  }

  async subscribeById(
    variables: GetContractDetailsQueryVariables,
    callback: (contract: Contract) => void
  ): Promise<SubscriptionHandle> {
    const listeners: SubscriptionHandle[] = [];

    for (const provider of this.providerManager.getProviders()) {
      if (!provider.subscribeById) {
        continue;
      }

      const handle = await provider.subscribeById(variables, callback);
      listeners.push(handle);
    }

    return {
      unsubscribe: () => {
        listeners.forEach((handle) => handle.unsubscribe());
      },
    };
  }
}
