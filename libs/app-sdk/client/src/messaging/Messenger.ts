// import { MessageHandler, Validation } from '@blue-company/app-sdk-core';

export class Messenger {
  private targetOrigin: string;

  constructor(targetOrigin: string) {
    // super();
    this.targetOrigin = targetOrigin;
  }

  // protected handleMessage(event: MessageEvent): void {
  //   if (!Validation.isValidOrigin(event.origin, [this.targetOrigin])) {
  //     return;
  //   }

  //   const message = event.data;
  //   if (Validation.isValidMessage(message)) {
  //     // Handle incoming messages
  //   }
  // }

  // public sendMessage(message: any): void {
  //   this.sendMessage(window.parent, message, this.targetOrigin);
  // }
}
