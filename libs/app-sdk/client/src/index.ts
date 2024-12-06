import { AppSDK } from './sdk';
import {
  SDKCommand,
  SDKFunction,
  SDKDataLayer,
  SDKCommandInitArgs,
} from './types';

declare global {
  interface Window {
    BlueAppSDK?: AppSDK;
    blueAppSDKQueue: SDKDataLayer;
    blueAppSDKPush: SDKFunction;
  }
}

if (typeof window !== 'undefined') {
  window.blueAppSDKQueue =
    window.blueAppSDKQueue || ([] as unknown as SDKDataLayer);

  window.blueAppSDKPush = function (...args: SDKCommand) {
    window.blueAppSDKQueue.push(args);
  };

  const processCommand = (command: SDKCommand): unknown => {
    const [method, ...args] = command;
    let sdk = window.BlueAppSDK;

    switch (method) {
      case 'init':
        if (!sdk) {
          sdk = AppSDK.getInstance(...(args as SDKCommandInitArgs));
          window.BlueAppSDK = sdk;
        }
        return;

      default: {
        const exhaustiveCheck: never = method;
        throw new Error(`Unknown command: ${exhaustiveCheck}`);
      }
    }
  };

  const processQueue = () => {
    const queue = window.blueAppSDKQueue;

    queue.forEach(processCommand);

    Object.defineProperty(queue, 'push', {
      value: (args: SDKCommand) => {
        return processCommand(args);
      },
      writable: false,
      configurable: true,
    });
  };

  processQueue();
}

export { AppSDK };
export type { SDKCommand, SDKFunction, SDKDataLayer };

export { EmailSetterMethod } from './api/methods/EmailSetter';
export { StripeCustomer } from './api/contracts/StripeCustomer';
