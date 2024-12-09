import {
  Communicator,
  Message,
  MessageBus,
  Logger,
} from '@blue-company/app-sdk-core';
import { ConnectionManager } from './ConnectionManager';

type SendMessageOptions = {
  waitUntilConnected?: boolean;
};

export class IframeCommunicator extends Communicator {
  private iframeElement: HTMLIFrameElement | null = null;
  private connectionManager: ConnectionManager;

  constructor(messageBus: MessageBus, logger: Logger) {
    super({ origin: '*', messageBus, logger });
    this.connectionManager = new ConnectionManager(this, messageBus);
  }

  connect(iframeElement: HTMLIFrameElement) {
    this.iframeElement = iframeElement;
    if (!iframeElement.contentWindow) {
      throw new Error(
        'Cannot establish communication: iframe contentWindow is null'
      );
    }
    this.targetWindow = iframeElement.contentWindow;
    super.startListeningForMessages();
    this.connectionManager.initialize();
  }

  disconnect() {
    this.connectionManager.disconnect();
    super.stopListeningForMessages();
    this.iframeElement = null;
    this.targetWindow = null;
  }

  getIframeElement() {
    return this.iframeElement;
  }

  override sendMessage(message: Message, options?: SendMessageOptions) {
    if (!this.connectionManager.isConnected && options?.waitUntilConnected) {
      this.connectionManager.queueMessage(message, options);
    } else {
      try {
        super.sendMessage(message);
      } catch (error) {
        console.error('Error sending message', error);
      }
    }
  }

  public get isConnected() {
    return this.connectionManager.isConnected;
  }
}
