import { isObject } from 'radash';

export class Validation {
  static isValidOrigin(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.includes(origin);
  }

  static isValidMessage(message: unknown): boolean {
    return (
      isObject(message) && 'type' in message && typeof message.type === 'string'
    );
  }
}
