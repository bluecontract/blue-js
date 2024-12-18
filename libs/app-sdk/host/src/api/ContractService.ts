import { KnowledgeProviderManager } from '../knowledgeProviders/Manager';
import { Contract } from '../knowledgeProviders/types';
import {
  ListContractsQueryVariables,
  GetContractDetailsQueryVariables,
  CallMethodMutationVariables,
  InitializeAgentQueryVariables,
} from '@blue-company/app-sdk-core';

export class ContractService {
  constructor(private providerManager: KnowledgeProviderManager) {}

  async listContracts(
    variables: ListContractsQueryVariables
  ): Promise<Contract[]> {
    // TODO: It should handle errors from providers
    const results: Contract[] = [];

    for (const provider of this.providerManager.getProviders()) {
      const contracts = await provider.listContracts?.(variables);
      if (contracts) {
        results.push(...contracts);
      }
    }

    return results;
  }

  async getContractDetails(
    variables: GetContractDetailsQueryVariables
  ): Promise<Contract> {
    for (const provider of this.providerManager.getProviders()) {
      const contract = await provider.getContractDetails?.(variables);
      if (contract) {
        return contract;
      }
    }
    throw new Error('Contract not found');
  }

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
