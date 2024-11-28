import { ApiRequestHandler } from './handlers/ApiRequestHandler';
import { PageHeightHandler } from './handlers/PageHeightHandler';
import { RouteChangeHandler } from './handlers/RouteChangeHandler';
import { KnowledgeProviderManager } from './knowledgeProviders/Manager';
import { KnowledgeProvider } from './knowledgeProviders/types';

import { IframeCommunicator } from './messaging/IframeCommunicator';
import { MessageBus } from '@blue-company/app-sdk-core';

export type HostAppSDKOptions = {
  onRouteChange: ConstructorParameters<typeof RouteChangeHandler>[1];
};

export class HostAppSDK {
  private messageBus: MessageBus;
  private providerManager: KnowledgeProviderManager;

  private communicator: IframeCommunicator;
  private pageHeightHandler: PageHeightHandler;
  private apiRequestHandler: ApiRequestHandler;
  private routeChangeHandler: RouteChangeHandler;

  constructor({ onRouteChange }: HostAppSDKOptions) {
    this.messageBus = new MessageBus();
    this.providerManager = new KnowledgeProviderManager();

    this.communicator = new IframeCommunicator(this.messageBus);
    this.pageHeightHandler = new PageHeightHandler(
      this.messageBus,
      this.communicator
    );
    this.apiRequestHandler = new ApiRequestHandler(
      this.messageBus,
      this.communicator,
      this.providerManager
    );
    this.routeChangeHandler = new RouteChangeHandler(
      this.messageBus,
      onRouteChange
    );
  }

  public registerProvider(provider: KnowledgeProvider) {
    this.providerManager.registerProvider(provider);
  }

  public unregisterProvider(name: string) {
    return this.providerManager.unregisterProvider(name);
  }

  public connectIframe(iframe: HTMLIFrameElement) {
    this.communicator.connect(iframe);
    this.pageHeightHandler.startHandling();
    this.apiRequestHandler.startHandling();
    this.routeChangeHandler.startHandling();

    return () => {
      this.communicator.disconnect();
      this.pageHeightHandler.stopHandling();
      this.apiRequestHandler.stopHandling();
      this.routeChangeHandler.stopHandling();
    };
  }

  public sendRouteChangeMessage(path: string) {
    this.communicator.sendMessage(
      { type: 'route-change', payload: { path } },
      { waitUntilConnected: true }
    );
  }
}
