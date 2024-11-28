import { defaultLoggerConfig } from './constants/logger';
import { ApiRequestHandler } from './handlers/ApiRequestHandler';
import { PageHeightHandler } from './handlers/PageHeightHandler';
import { RouteChangeHandler } from './handlers/RouteChangeHandler';
import { KnowledgeProviderManager } from './knowledgeProviders/Manager';
import { KnowledgeProvider } from './knowledgeProviders/types';

import { IframeCommunicator } from './messaging/IframeCommunicator';
import { MessageBus, Logger, LoggerConfig } from '@blue-company/app-sdk-core';

export type HostAppSDKOptions = {
  onRouteChange: ConstructorParameters<typeof RouteChangeHandler>[1];
  loggerConfig?: Partial<LoggerConfig>;
};

export class HostAppSDK {
  private messageBus: MessageBus;
  private providerManager: KnowledgeProviderManager;
  private logger: Logger;

  private communicator: IframeCommunicator;
  private pageHeightHandler: PageHeightHandler;
  private apiRequestHandler: ApiRequestHandler;
  private routeChangeHandler: RouteChangeHandler;

  constructor({ onRouteChange, loggerConfig }: HostAppSDKOptions) {
    this.logger = new Logger({ ...defaultLoggerConfig, ...loggerConfig });
    this.logger.debug('Initializing HostAppSDK...');

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

    this.logger.debug('HostAppSDK initialized successfully');
  }

  public registerProvider(provider: KnowledgeProvider) {
    this.logger.info(`Registering provider: ${provider.name}`);
    this.providerManager.registerProvider(provider);
  }

  public unregisterProvider(name: string) {
    this.logger.info(`Unregistering provider: ${name}`);
    return this.providerManager.unregisterProvider(name);
  }

  public connectIframe(iframe: HTMLIFrameElement) {
    this.logger.info('Connecting iframe...');
    this.communicator.connect(iframe);
    this.pageHeightHandler.startHandling();
    this.apiRequestHandler.startHandling();
    this.routeChangeHandler.startHandling();
    this.logger.info('Iframe connected successfully');

    return () => {
      this.logger.info('Disconnecting iframe...');
      this.communicator.disconnect();
      this.pageHeightHandler.stopHandling();
      this.apiRequestHandler.stopHandling();
      this.routeChangeHandler.stopHandling();
      this.logger.info('Iframe disconnected successfully');
    };
  }

  public sendRouteChangeMessage(path: string) {
    this.logger.debug(`Sending route change message for path: ${path}`);
    this.communicator.sendMessage(
      { type: 'route-change', payload: { path } },
      { waitUntilConnected: true }
    );
  }
}
