import {
  MessageBus,
  AsyncRequestMessagePayload,
} from '@blue-company/app-sdk-core';
import { IframeCommunicator } from '../messaging/IframeCommunicator';
import { KnowledgeProviderManager } from '../knowledgeProviders/Manager';
import { ContractService } from '../api/ContractService';

export class AsyncRequestHandler {
  private unsubscribeAsyncRequest: (() => void) | undefined = undefined;
  private contractService: ContractService;

  constructor(
    private messageBus: MessageBus,
    private communicator: IframeCommunicator,
    providerManager: KnowledgeProviderManager
  ) {
    this.contractService = new ContractService(providerManager);
  }

  public startHandling() {
    this.unsubscribeAsyncRequest =
      this.messageBus.subscribe<AsyncRequestMessagePayload>(
        'async-request',
        this.handleAsyncRequest
      );
  }

  public stopHandling() {
    this.unsubscribeAsyncRequest?.();
  }

  private handleAsyncRequest = async (payload: AsyncRequestMessagePayload) => {
    const requestId = payload.requestId;

    try {
      const result = await this.processAsyncRequest(payload);

      this.communicator.sendMessage({
        type: 'async-response',
        payload: { requestId, data: result },
      });
    } catch (error) {
      this.communicator.sendMessage({
        type: 'async-response',
        payload: {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  };

  private processAsyncRequest = async (
    payload: AsyncRequestMessagePayload
  ): Promise<unknown> => {
    const { type, variables } = payload;
    switch (type) {
      case 'call-method':
        return this.contractService.callMethod(variables);
      case 'initialize-agent':
        return this.contractService.initializeAgent(variables);
      default: {
        throw new Error(`Unsupported async request type: ${type}`);
      }
    }
  };
}
