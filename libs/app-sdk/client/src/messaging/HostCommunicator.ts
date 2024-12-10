import { Communicator, MessageBus, Logger } from '@blue-company/app-sdk-core';

export class HostCommunicator extends Communicator {
  constructor(messageBus: MessageBus, logger: Logger) {
    super({ targetWindow: window.parent, origin: '*', messageBus, logger });
  }
}
