import { HostCommunicator } from './messaging/HostCommunicator';
import { HostAPI } from './api/HostAPI';
import { PageHeightListener } from './listeners/PageHeightListener';
import { RouteChangeHandler } from './handlers/RouteChangeHandler';
import { MessageBus } from '@blue-company/app-sdk-core';
import { RouteChangeListener } from './listeners/RouteChangeListener';

export type AppSDKOptions = {
  onRouteChange?: ConstructorParameters<typeof RouteChangeHandler>[1];
};

export class AppSDK {
  private messageBus: MessageBus;
  private communicator: HostCommunicator;
  private pageHeightListener: PageHeightListener;
  private routeChangeListener: RouteChangeListener;
  private routeChangeHandler: RouteChangeHandler;
  private hostAPI: HostAPI;

  constructor({ onRouteChange }: AppSDKOptions = {}) {
    this.messageBus = new MessageBus();
    this.communicator = new HostCommunicator(this.messageBus);
    this.pageHeightListener = new PageHeightListener(this.communicator);
    this.routeChangeListener = new RouteChangeListener(this.communicator);
    this.routeChangeHandler = new RouteChangeHandler(
      this.messageBus,
      onRouteChange
    );
    this.hostAPI = new HostAPI(this.communicator, this.messageBus);
  }

  connectHost() {
    this.communicator.startListeningForMessages();
    this.pageHeightListener.startListening();
    this.routeChangeListener.startListening();
    this.routeChangeHandler.startHandling();

    return () => {
      this.communicator.stopListeningForMessages();
      this.pageHeightListener.stopListening();
      this.routeChangeListener.stopListening();
      this.routeChangeHandler.stopHandling();
    };
  }

  get api() {
    return this.hostAPI;
  }
}
