import { BaseMessage } from './types';

type CallbackFunction<TPayload = BaseMessage['payload']> = (
  payload: TPayload
) => void;

export class MessageBus {
  private listeners: Map<string, CallbackFunction[]> = new Map();

  subscribe<TPayload = BaseMessage['payload']>(
    type: string,
    callback: CallbackFunction<TPayload>
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)?.push(callback as CallbackFunction);

    return () => {
      const callbacks = this.listeners.get(type);
      if (callbacks) {
        const index = callbacks.indexOf(callback as CallbackFunction);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  publish(message: BaseMessage): void {
    const callbacks = this.listeners.get(message.type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(message.payload));
    }
  }
}
