import { HostCommunicator } from '../messaging/HostCommunicator';
import {
  AsyncRequestMessage,
  AsyncRequestMessagePayload,
  AsyncResponseMessage,
  AsyncResponsePayloadData,
  MessageBus,
} from '@blue-company/app-sdk-core';
import { SetOptional } from 'type-fest';

type RequestId = AsyncRequestMessage['payload']['requestId'];
type PromiseResolve<T> = (value: T | PromiseLike<T>) => void;
type PromiseReject = (reason?: unknown) => void;

export type SendRequestPayload = SetOptional<
  AsyncRequestMessagePayload,
  'requestId'
>;

export class AsyncBridge {
  private unsubscribe: (() => void) | undefined = undefined;
  private pendingPromises: Map<
    RequestId,
    { resolve: PromiseResolve<unknown>; reject: PromiseReject }
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

  sendRequest<
    TPayload extends SendRequestPayload,
    TResponse = AsyncResponsePayloadData<TPayload['type']>
  >({ requestId: requestIdArg, ...payload }: TPayload) {
    return new Promise<TResponse>((resolve, reject) => {
      const requestId = requestIdArg ?? this.generateRequestId();
      this.pendingPromises.set(requestId, {
        resolve: resolve as PromiseResolve<unknown>,
        reject,
      });

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
