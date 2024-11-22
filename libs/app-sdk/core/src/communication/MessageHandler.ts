import { Message } from './MessageTypes';

export abstract class MessageHandler {
  protected abstract handleMessage(event: Event): void;

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  protected sendMessage(
    targetWindow: Window,
    message: Message,
    targetOrigin: string
  ): void {
    targetWindow.postMessage(message, targetOrigin);
  }
}
