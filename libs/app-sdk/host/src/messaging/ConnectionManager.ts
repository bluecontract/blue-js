import {
  Message,
  MessageBus,
  InitResponseMessage,
} from '@blue-company/app-sdk-core';
import { IframeCommunicator } from './IframeCommunicator';

type SendMessageOptions = {
  waitUntilConnected?: boolean;
};

export class ConnectionManager {
  private unsubscribeInitResponse: (() => void) | undefined = undefined;

  public isConnected = false;
  private messagesToSend: Array<{
    message: Message;
    options?: SendMessageOptions;
  }> = [];

  constructor(
    private communicator: IframeCommunicator,
    private messageBus: MessageBus
  ) {}

  public initialize() {
    this.unsubscribeInitResponse = this.messageBus.subscribe<
      InitResponseMessage['payload']
    >('init-response', this.handleInitResponseMessage);
  }

  public queueMessage(message: Message, options?: SendMessageOptions) {
    this.messagesToSend.push({ message, options });
  }

  private handleInitResponseMessage = (
    payload: InitResponseMessage['payload']
  ) => {
    if (payload.appId === 'host-sdk') {
      this.isConnected = true;
      this.flushMessageQueue();
    }
  };

  private flushMessageQueue() {
    while (this.messagesToSend.length > 0) {
      const [messageToSend, ...remainingMessages] = this.messagesToSend;
      this.messagesToSend = remainingMessages;
      this.communicator.sendMessage(
        messageToSend.message,
        messageToSend.options
      );
    }
  }

  public disconnect() {
    this.isConnected = false;
    this.messagesToSend = [];
    this.unsubscribeInitResponse?.();
  }
}
