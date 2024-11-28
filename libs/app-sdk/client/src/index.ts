import { HostCommunicator } from './messaging/HostCommunicator';
import { HostAPI } from './api/HostAPI';
import { PageHeightListener } from './listeners/PageHeightListener';
import { RouteChangeHandler } from './handlers/RouteChangeHandler';
import { MessageBus, Logger, LoggerConfig } from '@blue-company/app-sdk-core';
import { RouteChangeListener } from './listeners/RouteChangeListener';

export type AppSDKOptions = {
  onRouteChange?: ConstructorParameters<typeof RouteChangeHandler>[1];
  loggerConfig?: Partial<LoggerConfig>;
};

const defaultLoggerConfig: LoggerConfig = {
  level: 'info',
  prefix: 'AppSDK-Client',
};

export class AppSDK {
  private messageBus: MessageBus;
  private communicator: HostCommunicator;
  private pageHeightListener: PageHeightListener;
  private routeChangeListener: RouteChangeListener;
  private routeChangeHandler: RouteChangeHandler;
  private hostAPI: HostAPI;
  private logger: Logger;

  constructor({ onRouteChange, loggerConfig }: AppSDKOptions = {}) {
    this.logger = new Logger({ ...defaultLoggerConfig, ...loggerConfig });
    this.logger.debug('Initializing AppSDK client...');

    this.messageBus = new MessageBus();
    this.communicator = new HostCommunicator(this.messageBus);
    this.pageHeightListener = new PageHeightListener(this.communicator);
    this.routeChangeListener = new RouteChangeListener(this.communicator);
    this.routeChangeHandler = new RouteChangeHandler(
      this.messageBus,
      onRouteChange
    );
    this.hostAPI = new HostAPI(this.communicator, this.messageBus);

    this.logger.debug('AppSDK client initialized successfully');
  }

  connectHost() {
    this.logger.info('Connecting to host...');
    this.communicator.startListeningForMessages();
    this.pageHeightListener.startListening();
    this.routeChangeListener.startListening();
    this.routeChangeHandler.startHandling();
    this.logger.info('Successfully connected to host');

    return () => {
      this.logger.info('Disconnecting from host...');
      this.communicator.stopListeningForMessages();
      this.pageHeightListener.stopListening();
      this.routeChangeListener.stopListening();
      this.routeChangeHandler.stopHandling();
      this.logger.info('Successfully disconnected from host');
    };
  }

  get api() {
    return this.hostAPI;
  }
}
