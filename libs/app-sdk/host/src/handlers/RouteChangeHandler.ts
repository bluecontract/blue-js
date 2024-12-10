import { MessageBus, RouteChangeMessage } from '@blue-company/app-sdk-core';

type OnRouteChange = (payload: RouteChangeMessage['payload']) => void;

export class RouteChangeHandler {
  private unsubscribe: (() => void) | undefined = undefined;

  constructor(
    private messageBus: MessageBus,
    private onRouteChange: OnRouteChange
  ) {}

  public startHandling() {
    this.unsubscribe = this.messageBus.subscribe<RouteChangeMessage['payload']>(
      'route-change',
      this.handleRouteChange
    );
  }

  public stopHandling() {
    this.unsubscribe?.();
  }

  private handleRouteChange = (payload: RouteChangeMessage['payload']) => {
    this.onRouteChange(payload);
  };
}
