import { HostCommunicator } from './messaging/HostCommunicator';
import { AsyncBridge, SendRequestPayload } from './api/AsyncBridge';
import { PageHeightListener } from './listeners/PageHeightListener';
import { RouteChangeHandler } from './handlers/RouteChangeHandler';
import {
  MessageBus,
  Logger,
  LoggerConfig,
  InitMessage,
  AsyncResponsePayloadData,
  InitializeAgentQueryVariables,
} from '@blue-company/app-sdk-core';
import { RouteChangeListener } from './listeners/RouteChangeListener';
import { defaultLoggerConfig } from './constants/logger';
import { IframeResizer } from './resizer/IframeResizer';
import { BaseAgentClient } from './api/agents/BaseAgentClient';
import { getBlueAgentClientMetadata } from './api/decorators';

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
  private asyncBridge: AsyncBridge;
  private logger: Logger;
  private iframeResizer: IframeResizer;

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
    this.iframeResizer = new IframeResizer(this.logger);

    this.pageHeightListener = new PageHeightListener(
      this.communicator,
      this.iframeResizer
    );

    this.routeChangeListener = new RouteChangeListener(this.communicator);
    this.routeChangeHandler = new RouteChangeHandler(
      this.messageBus,
      onRouteChange
    );
    this.asyncBridge = new AsyncBridge(this.communicator, this.messageBus);

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
      payload: {
        pathname: window.location.pathname,
      },
    });
  }

  private handleInitMessage = (payload: InitMessage['payload']) => {
    if (this.isConnected) {
      this.logger.warn('AppSDK is already connected to host');
      return;
    }
    this.iframeResizer.checkAndSetupTags();

    this.iframeResizer.injectClearFixIntoBodyElement();
    this.iframeResizer.stopInfiniteResizingOfIframe();
    this.iframeResizer.applySizeSelector();

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
    this.asyncBridge.startListening();

    this.isConnected = true;
    this.logger.info('AppSDK connected successfully to host');
  };

  public askUserForAgent = async <T extends typeof BaseAgentClient>(
    variables: InitializeAgentQueryVariables,
    AgentClient: T
  ) => {
    const methodDefinitions = AgentClient.getMethodDefinitions();
    const clientMetadata = getBlueAgentClientMetadata(AgentClient, true);

    const response = await this.sendAsyncRequest({
      type: 'initialize-agent',
      variables: {
        ...variables,
        contract: {
          ...variables.contract,
          object: {
            type: clientMetadata?.objectType,
            ...(variables.contract?.object ?? {}),
          },
          workflows: methodDefinitions,
        },
      },
    });

    return new AgentClient(response.agentId) as InstanceType<T>;
  };

  public sendAsyncRequest<
    TPayload extends SendRequestPayload,
    TResponse = AsyncResponsePayloadData<TPayload['type']>
  >(payload: TPayload) {
    return this.asyncBridge.sendRequest<TPayload, TResponse>(payload);
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
    this.asyncBridge.stopListening();

    this.unsubscribeInitListener?.();
    this.messageBus.unsubscribeAll();
    this.communicator.stopListeningForMessages();

    this.isConnected = false;
    this.logger.info('AppSDK disconnected successfully from host');
  }
}
