import { MessageBus, RouteChangeMessage } from '@blue-company/app-sdk-core';

type OnRouteChange = (payload: RouteChangeMessage['payload']) => void;

export class RouteChangeHandler {
  private unsubscribeRouteChange: (() => void) | undefined = undefined;
  private previousPathname?: string;

  constructor(
    private messageBus: MessageBus,
    private onRouteChange?: OnRouteChange
  ) {}

  public startHandling() {
    this.previousPathname = window.location.pathname;

    this.unsubscribeRouteChange = this.messageBus.subscribe<
      RouteChangeMessage['payload']
    >('route-change', this.handleRouteChange);
  }

  public stopHandling() {
    this.unsubscribeRouteChange?.();
    this.previousPathname = undefined;
  }

  private handleRouteChange = (payload: RouteChangeMessage['payload']) => {
    const { path } = payload;
    if (path === this.previousPathname) {
      return;
    }

    this.previousPathname = path;

    if (this.onRouteChange) {
      this.onRouteChange(payload);
    } else {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const url = `${window.location.origin}${normalizedPath}`;
      window.location.href = url;
    }
  };
}
