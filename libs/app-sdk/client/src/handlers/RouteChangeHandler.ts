import { MessageBus, RouteChangeMessage } from '@blue-company/app-sdk-core';

type OnRouteChange = (payload: RouteChangeMessage['payload']) => void;

export class RouteChangeHandler {
  private unsubscribeRouteChange: (() => void) | undefined = undefined;
  private previousPathname?: string;

  constructor(
    private messageBus: MessageBus,
    private onRouteChange?: OnRouteChange
  ) {}

  public startHandling(initialPathname?: string) {
    this.previousPathname = window.location.pathname;

    this.unsubscribeRouteChange = this.messageBus.subscribe<
      RouteChangeMessage['payload']
    >('route-change', this.handleRouteChange);

    if (initialPathname && initialPathname !== window.location.pathname) {
      this.handleRouteChange({ pathname: initialPathname });
    }
  }

  public stopHandling() {
    this.unsubscribeRouteChange?.();
    this.previousPathname = undefined;
  }

  private handleRouteChange = (payload: RouteChangeMessage['payload']) => {
    const { pathname } = payload;
    if (pathname === this.previousPathname) {
      return;
    }

    if (this.onRouteChange) {
      this.onRouteChange(payload);
    } else {
      const normalizedPath = pathname.startsWith('/')
        ? pathname
        : `/${pathname}`;
      const url = `${window.location.origin}${normalizedPath}`;
      window.location.href = url;
    }

    this.previousPathname = pathname;
  };
}
