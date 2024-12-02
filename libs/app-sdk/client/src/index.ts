import { AppSDK } from './sdk';

declare global {
  interface Window {
    AppSDK?: AppSDK;
  }
}

if (typeof window !== 'undefined' && !window.AppSDK) {
  window.AppSDK = AppSDK.getInstance();
}
