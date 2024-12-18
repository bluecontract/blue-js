import {
  MessageBus,
  ApiRequestMessagePayload,
} from '@blue-company/app-sdk-core';
import { IframeCommunicator } from '../messaging/IframeCommunicator';
import { KnowledgeProviderManager } from '../knowledgeProviders/Manager';
import { ContractService } from '../api/ContractService';

export class ApiRequestHandler {
  private unsubscribeApiRequest: (() => void) | undefined = undefined;
  private contractService: ContractService;

  constructor(
    private messageBus: MessageBus,
    private communicator: IframeCommunicator,
    providerManager: KnowledgeProviderManager
  ) {
    this.contractService = new ContractService(providerManager);
  }

  public startHandling() {
    this.unsubscribeApiRequest =
      this.messageBus.subscribe<ApiRequestMessagePayload>(
        'api-request',
        this.handleApiRequest
      );
  }

  public stopHandling() {
    this.unsubscribeApiRequest?.();
  }

  private handleApiRequest = async (payload: ApiRequestMessagePayload) => {
    const requestId = payload.requestId;

    try {
      const result = await this.processApiRequest(payload);

      this.communicator.sendMessage({
        type: 'api-response',
        payload: { requestId, data: result },
      });
    } catch (error) {
      this.communicator.sendMessage({
        type: 'api-response',
        payload: {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  };

  private processApiRequest = async (
    payload: ApiRequestMessagePayload
  ): Promise<unknown> => {
    switch (payload.type) {
      case 'list-contracts':
        return this.contractService.listContracts(payload.variables);
      case 'get-contract-details':
        return this.contractService.getContractDetails(payload.variables);
      case 'call-method':
        return this.contractService.callMethod(payload.variables);
      case 'initialize-agent':
        return this.contractService.initializeAgent(payload.variables);
      default: {
        throw new Error(`Unsupported API request type: ${payload.type}`);
      }
    }
  };
}
