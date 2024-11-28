import { Communicator, Message, MessageBus } from '@blue-company/app-sdk-core';

type SendMessageOptions = {
  waitUntilConnected?: boolean;
};

export class IframeCommunicator extends Communicator {
  private iframeElement: HTMLIFrameElement | null = null;
  private messagesToSend: Array<{
    message: Message;
    options?: SendMessageOptions;
  }> = [];
  private isConnected = false;

  constructor(messageBus: MessageBus) {
    super({ origin: '*', messageBus });
  }

  connect(iframeElement: HTMLIFrameElement) {
    this.iframeElement = iframeElement;
    if (!iframeElement.contentWindow) {
      throw new Error(
        'Cannot establish communication: iframe contentWindow is null'
      );
    }
    this.targetWindow = iframeElement.contentWindow;
    this.isConnected = true;
    this.flushMessageQueue();
    super.startListeningForMessages();
  }

  disconnect() {
    this.iframeElement = null;
    this.targetWindow = null;
    this.isConnected = false;
    this.messagesToSend = [];
    super.stopListeningForMessages();
  }

  getIframeElement() {
    return this.iframeElement;
  }

  override sendMessage(message: Message, options?: SendMessageOptions) {
    if (!this.isConnected && options?.waitUntilConnected) {
      this.messagesToSend.push({ message, options });
    } else {
      this.sendMessageImmediately(message);
    }
  }

  private sendMessageImmediately(message: Message) {
    try {
      super.sendMessage(message);
    } catch (error) {
      console.error('Error sending message', error);
    }
  }

  private flushMessageQueue() {
    while (this.messagesToSend.length > 0) {
      const [messageToSend, ...remainingMessages] = this.messagesToSend;
      this.messagesToSend = remainingMessages;
      this.sendMessageImmediately(messageToSend.message);
    }
  }
}
