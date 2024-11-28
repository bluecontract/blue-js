import { Communicator, MessageBus } from '@blue-company/app-sdk-core';

export class HostCommunicator extends Communicator {
  constructor(messageBus: MessageBus) {
    super({ targetWindow: window.parent, origin: '*', messageBus });
  }
}
