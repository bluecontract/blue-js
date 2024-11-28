import { Message } from './MessageTypes';
import { MessageBus } from './MessageBus';

export abstract class Communicator {
  protected targetWindow: Window | null = null;
  protected origin: string;
  protected messageBus: MessageBus;

  constructor({
    targetWindow,
    origin,
    messageBus,
  }: {
    targetWindow?: Window;
    origin: string;
    messageBus: MessageBus;
  }) {
    this.targetWindow = targetWindow ?? null;
    this.origin = origin;
    this.messageBus = messageBus;
  }

  public startListeningForMessages() {
    window.addEventListener('message', this.receiveMessage, false);
  }

  public sendMessage(message: Message): void {
    if (!this.targetWindow) {
      throw new Error('No target window to send message to');
    }
    this.targetWindow.postMessage(message, this.origin);
  }

  private receiveMessage = (event: MessageEvent<Message>) => {
    if (this.origin !== '*' && event.origin !== this.origin) return;
    // TODO: Validate event data
    this.messageBus.publish(event.data);
  };

  public stopListeningForMessages() {
    window.removeEventListener('message', this.receiveMessage, false);
  }
}
