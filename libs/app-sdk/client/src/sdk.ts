import { HostCommunicator } from './messaging/HostCommunicator';
import { HostAPI } from './api/HostAPI';
import { PageHeightListener } from './listeners/PageHeightListener';
import { RouteChangeHandler } from './handlers/RouteChangeHandler';
import {
  MessageBus,
  Logger,
  LoggerConfig,
  InitMessage,
} from '@blue-company/app-sdk-core';
import { RouteChangeListener } from './listeners/RouteChangeListener';
import { defaultLoggerConfig } from './constants/logger';

export type AppSDKConfig = Readonly<{
  onRouteChange?: ConstructorParameters<typeof RouteChangeHandler>[1];
  loggerConfig?: Partial<LoggerConfig>;
}>;

export class AppSDK {
  private static instance: AppSDK | null = null;

  private messageBus: MessageBus;
  private communicator: HostCommunicator;
  private pageHeightListener: PageHeightListener;
  private routeChangeListener: RouteChangeListener;
  private routeChangeHandler: RouteChangeHandler;
  private hostAPI: HostAPI;
  private logger: Logger;

  private isConnected = false;

  private unsubscribeInitListener?: () => void;

  static getInstance(config: AppSDKConfig = {}): AppSDK {
    if (!AppSDK.instance) {
      AppSDK.instance = new AppSDK(config);
    }

    return AppSDK.instance;
  }

  private constructor({ loggerConfig, onRouteChange }: AppSDKConfig = {}) {
    this.logger = new Logger({
      ...defaultLoggerConfig,
      ...loggerConfig,
    });
    this.logger.debug('Creating AppSDK instance...');

    this.messageBus = new MessageBus();
    this.communicator = new HostCommunicator(this.messageBus, this.logger);
    this.pageHeightListener = new PageHeightListener(this.communicator);
    this.routeChangeListener = new RouteChangeListener(this.communicator);
    this.routeChangeHandler = new RouteChangeHandler(
      this.messageBus,
      onRouteChange
    );
    this.hostAPI = new HostAPI(this.communicator, this.messageBus);

    this.connect();
  }

  public connect(): void {
    if (this.isConnected) {
      this.logger.warn('AppSDK is already connected');
      return;
    }

    this.logger.debug('Connecting AppSDK to host...');

    this.unsubscribeInitListener = this.messageBus.subscribe<
      InitMessage['payload']
    >('init', this.handleInitMessage);
    this.communicator.startListeningForMessages();
    this.communicator.sendMessage({
      type: 'ready',
    });
  }

  private handleInitMessage = (payload: InitMessage['payload']) => {
    if (this.isConnected) {
      this.logger.warn('AppSDK is already connected to host');
      return;
    }

    this.communicator.sendMessage({
      type: 'init-response',
      payload: {
        ...payload,
        version: '0.0.0',
      },
    });

    this.routeChangeHandler.startHandling(payload.initialPathname);
    this.pageHeightListener.startListening();
    this.routeChangeListener.startListening();
    this.hostAPI.startListening();

    this.isConnected = true;
    this.logger.info('AppSDK connected successfully to host');
  };

  get api() {
    return this.hostAPI;
  }

  public disconnect(): void {
    if (!this.isConnected) {
      this.logger.warn('AppSDK is already disconnected');
      return;
    }

    this.logger.info('Disconnecting AppSDK from host...');

    this.pageHeightListener.stopListening();
    this.routeChangeListener.stopListening();
    this.routeChangeHandler.stopHandling();
    this.hostAPI.stopListening();

    this.unsubscribeInitListener?.();
    this.messageBus.unsubscribeAll();
    this.communicator.stopListeningForMessages();

    this.isConnected = false;
    this.logger.info('AppSDK disconnected successfully from host');
  }
}
