import { Message } from './MessageTypes';

type EventCallback = (message: Message) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: { [type: string]: EventCallback[] } = {};

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on(type: string, callback: EventCallback): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  public off(type: string, callback: EventCallback): void {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(
        (cb) => cb !== callback
      );
    }
  }

  public emit(message: Message): void {
    const listeners = this.listeners[message.type];
    if (listeners) {
      listeners.forEach((callback) => callback(message));
    }
  }
}
