import { HostCommunicator } from '../messaging/HostCommunicator';
import {
  AsyncRequestMessage,
  AsyncRequestMessagePayload,
  AsyncResponseMessage,
  MessageBus,
} from '@blue-company/app-sdk-core';

type RequestId = AsyncRequestMessage['payload']['requestId'];
type PromiseResolve = (value: unknown) => void;
type PromiseReject = (reason?: unknown) => void;

export type SendRequestPayload = Omit<
  AsyncRequestMessagePayload,
  'requestId'
> & {
  requestId?: string;
};

export class AsyncBridge {
  private unsubscribe: (() => void) | undefined = undefined;
  private pendingPromises: Map<
    RequestId,
    { resolve: PromiseResolve; reject: PromiseReject }
  > = new Map();

  constructor(
    private communicator: HostCommunicator,
    private messageBus: MessageBus
  ) {}

  startListening(): void {
    this.unsubscribe = this.messageBus.subscribe<
      AsyncResponseMessage['payload']
    >('async-response', this.handleResponse.bind(this));
  }

  stopListening(): void {
    this.unsubscribe?.();
  }

  sendRequest({
    requestId: requestIdArg,
    ...payload
  }: SendRequestPayload): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = requestIdArg ?? this.generateRequestId();
      this.pendingPromises.set(requestId, { resolve, reject });
      this.communicator.sendMessage({
        type: 'async-request',
        payload: {
          requestId,
          ...payload,
        },
      });
    });
  }

  private handleResponse(payload: AsyncResponseMessage['payload']): void {
    const { requestId, data, error } = payload;
    const promiseHandlers = this.pendingPromises.get(requestId);

    if (promiseHandlers) {
      if (error) {
        promiseHandlers.reject(error);
      } else {
        promiseHandlers.resolve(data);
      }
      this.pendingPromises.delete(requestId);
    }
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2);
  }
}
