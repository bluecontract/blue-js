import { KnowledgeProviderManager } from '../knowledgeProviders/Manager';
import {
  CallMethodMutationVariables,
  InitializeAgentQueryVariables,
} from '@blue-company/app-sdk-core';

export class ContractService {
  constructor(private providerManager: KnowledgeProviderManager) {}

  async initializeAgent(variables: InitializeAgentQueryVariables) {
    for (const provider of this.providerManager.getProviders()) {
      const result = await provider.initializeAgent?.(variables);
      if (result) {
        return result;
      }
    }
    throw new Error('Agent not found');
  }

  async callMethod(variables: CallMethodMutationVariables) {
    for (const provider of this.providerManager.getProviders()) {
      const result = await provider.callMethod?.(variables);
      if (result) {
        return result;
      }
    }
    throw new Error('Method not found');
  }
}
