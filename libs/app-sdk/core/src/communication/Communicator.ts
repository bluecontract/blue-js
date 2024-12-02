import { Message } from './types';
import { MessageBus } from './MessageBus';
import { Logger } from '../logger';
import { isMessage } from './isMessage';

export abstract class Communicator {
  protected targetWindow: Window | null = null;
  protected origin: string;
  protected messageBus: MessageBus;
  protected logger?: Logger;

  constructor({
    targetWindow,
    origin,
    messageBus,
    logger,
  }: {
    targetWindow?: Window;
    origin: string;
    messageBus: MessageBus;
    logger?: Logger;
  }) {
    this.targetWindow = targetWindow ?? null;
    this.origin = origin;
    this.messageBus = messageBus;
    this.logger = logger;
  }

  public startListeningForMessages() {
    window.addEventListener('message', this.receiveMessage, false);
  }

  public sendMessage(message: Message): void {
    if (!this.targetWindow) {
      throw new Error('No target window to send message to');
    }
    this.logger?.debug(`Sending message to ${this.origin}`, message);
    this.targetWindow.postMessage(message, this.origin);
  }

  private receiveMessage = (event: MessageEvent<unknown>) => {
    if (
      (this.origin !== '*' && event.origin !== this.origin) ||
      !isMessage(event.data)
    ) {
      return;
    }

    this.logger?.debug(`Received message from ${event.origin}`, event.data);

    this.messageBus.publish(event.data);
  };

  public stopListeningForMessages() {
    window.removeEventListener('message', this.receiveMessage, false);
  }
}
